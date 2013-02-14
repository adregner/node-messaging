var net = require('net'),
    fs = require('fs'),
    os = require('os'),
    uuid = require('node-uuid');

var MASTER_HOST = "nodes.aregner.net",
    LISTEN_PORT = 7070,
    HOSTNAME = os.hostname(),
    PULSE_INTERVAL = 1000 * 15,
    PULSE_TIMEOUT = (PULSE_INTERVAL * 2) + 2,
    CLIENTS = {},
    PAST_MESSAGES = {};

function send_message(sock, message) {
  var body = JSON.stringify(message) +"\n";
  sock.write(body);
}

function client_key(conn) {
  return conn.remoteAddress +":"+ conn.remotePort;
}

function send_heartbeat() {
  send_message(Server, { message: 'hb' });
}

function reset_client_timeout(conn) {
  var key = client_key(conn);
  clearTimeout(conn.monitor);
  conn.monitor = setTimeout(function() { kill_client(key) }, PULSE_TIMEOUT);
}
function kill_client(key) {
  var conn = CLIENTS[key];

  // the connection may already be closed
  if(!conn) return;

  console.info("killing client", key);
  try {
    send_message(conn, { message: 'goodbye' });
  }
  catch(ex) {
    console.log("socket already closed");
  }
  conn.end();
  clearTimeout(conn.monitor);
  delete CLIENTS[key];
}

function reset_server_timeout() {
  clearTimeout(Server.monitor);
  Server.monitor = setTimeout(reconnect_server, PULSE_TIMEOUT);
}
function reconnect_server() {
  console.warn("server didn't respond, reconnecting.");
  try {
    send_message(Server, { message: 'goodbye' });
  }
  catch(ex) {
    console.log("socket already closed");
  }
  Server.end();
  clearTimeout(Server.monitor);
  connect_to_server();
}

function handle_new_message(message, key) {
  var data = null, conn = null;

  if(key) {
    // this is a message from a client to a server
    //console.log("new message from client");
    conn = CLIENTS[key];
    reset_client_timeout(conn);
  }
  else {
    // message from the server to the client
    //console.log("new message from server");
    conn = Server;
    reset_server_timeout();
  }

  try {
    data = JSON.parse(message);
  }
  catch(ex) {
    console.warn("Error parsing message:", message);
    return;
  }

  switch(data.message) {
    case 'newnode': // client introduction
      console.log("there's a new node in our lives", data.name);
      break;

    case 'hb': // from a client
      //console.log("reset timeout for", client_key(conn));
      send_message(conn, { message: 'hbok' });
      break;

    case 'hbok': // from the server
      //console.log("reset timeout for the server we are connected to");
      break;

    case 'goodbye': // from anyone that has droped us
      console.info("got goodbye and DC'ed from", client_key(conn));
      if(key) {
        kill_client(key);
      }
      else {
        reconnect_server();
      }
      break;

    default:
      console.warn("Unhandled message:", data);
      // copy this message to all other clients
  }
}

/**
 * Our general purpose listener
 */
var Listener = net.createServer(function(conn) {
  var key = client_key(conn);

  // new client connected, remember them
  CLIENTS[key] = conn;

  // kill them sometime in the future
  conn.monitor = setTimeout(function() { kill_client(key) }, PULSE_TIMEOUT);

  // clean up if the client disconnects
  conn.on('end', function() { kill_client(key) });

  // process their messages
  conn.on('data', function(data) { handle_new_message(data, key) });
});

var Server, pulse;

function connect_to_server() {
  Server = net.connect({host: MASTER_HOST, port: LISTEN_PORT}, function() {
    // connected to the master listener
    send_message(Server, { message: 'newnode', name: os.hostname(), });
    pulse = setInterval(send_heartbeat, PULSE_INTERVAL);
    Server.monitor = setTimeout(reconnect_server, PULSE_TIMEOUT);
  });

  Server.on('data', handle_new_message);
}

// connect to the server once we are listening
Listener.listen(LISTEN_PORT, connect_to_server);
