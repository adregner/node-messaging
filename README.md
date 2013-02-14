node-messaging
==============

Node.js distributed, resilient, low-impact messaging framework for passing information along a swarm of systems.

This is still in active development and isn't polished yet.  In the end, it will allow you to simply install it on all your systems and be able to pass a message from any system in the "swarm" to any other system.  It uses a central server to listen for new clients that want to join the swarm, but it won't be tied to that.  In reality, all nodes are also servers, and if their local networking configuration allows, they could handle a swarm of their own for a more distributed configuration.

The end-goal of this project includes all clients announcing to the swarm that they are there, and having all other nodes connect to them as servers if they are able.  This creates a partial mesh topology, which would continue working normally when the original / central master node goes down.  In this case, the master node the clients connect to in the beginning can be a load balanced VIP or DNS name with multiple records.
