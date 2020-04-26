const path = require("path");
const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server, {});

const port = 3000;

var SOCKETS = {};

// Tells our server where to connect to the client html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// This is where the client side directory resides
app.use(express.static(path.join(__dirname, "../client")));

// Triggers when a new client connects
io.sockets.on("connection", (socket) => {
  console.log("User has connected!");

  socket.x = 0;
  socket.y = 0;

  SOCKETS[socket.id] = socket;

  socket.broadcast.emit("user_connect", {id: socket.id, x: socket.x, y: socket.y});

  // Send the new client all of the other clients that were already connected
  for (let [key, value] of Object.entries(SOCKETS)) {
    if (value.id !== socket.id) {
      socket.emit("currentSocket", {id: value.id, x: value.x, y: value.y});
    };
  }

  socket.emit("serverMsg", "Welcome to Pulsar!");

  // Triggers when this socket disconnects and removes them from the sockets object
  socket.on("disconnect", () => {
    io.emit("user_disconnect", {id: socket.id});
    delete SOCKETS[socket.id]
  });

  // Triggers whenever a player takes an action or otherwise changes
  socket.on("player_update", (obj) => {
    socket.x = obj.x;
    socket.y = obj.y;
    socket.broadcast.emit("update_entity", {id: socket.id, x: socket.x, y: socket.y});
  });
});

server.listen(port);
console.log("Server started! Listening on port: " + port);

