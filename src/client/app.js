const nano = require("nano-ecs");
const components = require("./components/main");
const systems = require("./systems/main");
const factories = require("./factories/main");

const socket = io();
var world = nano();
var running = false;

// All of our UI buttons
const quitBtn = document.getElementsByClassName("quit-btn");
const messagePanel = document.querySelector(".message-panel");
const messageForm = document.querySelector(".message-form");
const messageInput = document.querySelector(".message-input");

// Updates the list of players
const queryPlayers = (world) => {
  return players = world.queryTag("player");
};

// Creates the current user
var player = factories.createPlayer(world, true, components, 0, 0);
var players = queryPlayers(world);

console.log("Connection to server successful!");

// When the server sends a message we want to see it!
socket.on("serverMsg", (msg) => {
  var message_label = document.createElement("p");
  message_label.innerText = msg;
  messagePanel.append(message_label)
  messagePanel.scrollTop = messagePanel.scrollHeight;
});

socket.on("player_msg_receive", (msg) => {
  var message_label = document.createElement("p");
  message_label.innerText = msg;
  messagePanel.append(message_label)
  messagePanel.scrollTop = messagePanel.scrollHeight;
});

// Gets all the players already connected from before
socket.on("currentSocket", (s) => {
  factories.createPlayer(world, false, components, s.x, s.y, s.id);
  queryPlayers(world);
});

// When another user connects do this stuff
socket.on("user_connect", (s) => {
  console.log("Another user has connected");
  factories.createPlayer(world, false, components, s.x, s.y, s.id);
  queryPlayers(world);
});

// When a user disconnects delete that entity
socket.on("user_disconnect", (data) => {
  console.log("A user has disconnected from the game");
  var entities = world.queryComponents([components.Position, components.SocketID]);
  var found_entity = entities.find(e => e.socketID.id === data.id);
  world.removeEntity(found_entity);
  queryPlayers(world);
});

// Whenever anything about the player changes, send them to the server
socket.on("update_entity", (entity) => {
  var entities = world.queryComponents([components.SocketID]);
  var i = entities.findIndex(e => e.socketID.id === entity.id);
  entities[i].position.x = entity.x;
  entities[i].position.y = entity.y;
});

// The game screen where everything is drawn
const canvas = document.querySelector(".game-screen");
canvas.width = 672;
canvas.height = 512;

// What happens when a user presses a button
quitBtn[0].addEventListener("click", () => { running = false });
messageForm.addEventListener("submit", (e) => handleSendMessage(e));

document.addEventListener("keydown", event => {
  if (document.activeElement !== messageInput) {
    switch(event.isComposing || event.keyCode) {
      case 87:
        handlePlayerMove(player, "n"); break
      case 83:
        handlePlayerMove(player, "s"); break
      case 68:
        handlePlayerMove(player, "e"); break
      case 65:
        handlePlayerMove(player, "w"); break
    }
  }
});

const handlePlayerMove = (player, dir) => {
  switch(dir) {
    case "n": player.position.y -= 16; break
    case "s": player.position.y += 16; break
    case "e": player.position.x += 16; break
    case "w": player.position.x -= 16; break
  };
  socket.emit("player_update", {x: player.position.x, y: player.position.y});
};

const handleSendMessage = (e) => {
  e.preventDefault();
  socket.emit("player_msg_send", e.target[0].value);
  messageForm.reset();
};

// Redraws the canvas
const draw = (entities) => {
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-player.position.x + canvas.width / 2, -player.position.y + canvas.height / 2);
  ctx.font = "16px Arial";
  ctx.fillStyle = "white";
  entities.forEach(e => {
    if (e.hasComponent(components.Position)) {
      e.hasComponent(components.SocketID) ? ctx.fillStyle = "teal" : null;
      ctx.fillText("@", e.position.x, e.position.y);
    };
  });
  ctx.restore();
};

running = true;
var ticks = 0;

const tick = () => {
  if (running == false) {
    clearInterval(game_loop);
    console.log("Game ended!");
  };

  draw(players);
};

// Tick 6 frames per second
const game_loop = setInterval(tick, 1000/6);

