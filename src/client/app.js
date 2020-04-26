const nano = require("nano-ecs");
const components = require("./components/main");
const systems = require("./systems/main");
const factories = require("./factories/main");

const socket = io();
var world = nano();
var running = false;

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
  console.log(msg);
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

// All of our UI buttons
const quitBtn = document.getElementsByClassName("quit-btn");
const northBtn = document.getElementsByClassName("north-btn");
const southBtn = document.getElementsByClassName("south-btn");
const eastBtn = document.getElementsByClassName("east-btn");
const westBtn = document.getElementsByClassName("west-btn");

// The game screen where everything is drawn
const canvas = document.querySelector(".game-screen");
canvas.width = 512;
canvas.height = 512;

// What happens when a user presses a button
quitBtn[0].addEventListener("click", () => { running = false });
northBtn[0].addEventListener("click", () => handlePlayerMove(player, "n"));
southBtn[0].addEventListener("click", () => handlePlayerMove(player, "s"));
eastBtn[0].addEventListener("click", () => handlePlayerMove(player, "e"));
westBtn[0].addEventListener("click", () => handlePlayerMove(player, "w"));

const handlePlayerMove = (player, dir) => {
  switch(dir) {
    case "n": player.position.y -= 16; break
    case "s": player.position.y += 16; break
    case "e": player.position.x += 16; break
    case "w": player.position.x -= 16; break
  };
  socket.emit("player_update", {x: player.position.x, y: player.position.y});
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

