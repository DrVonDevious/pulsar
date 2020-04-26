(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = require('./lib/EntityManager.js')

},{"./lib/EntityManager.js":3}],2:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
var util = require('util')

module.exports = Entity

util.inherits(Entity, EventEmitter)

/**
 * Basic component-driven object with facade functions for interacting with the
 * injected EntityManager object.
 * @constructor
 */
function Entity () {
  /**
   * Unique identifier.
   */
  this.id = nextId++

  /**
   * Ref to the manager for this facade, injected right after being
   * instantiated.
   * @private
   */
  this._manager = null

  /**
   * List of all the types of components on this entity.
   * @type {Array.<Function>}
   * @private
   */
  this._Components = []

  /**
   * All tags that this entity currently has.
   * @type {Array.<String>}
   * @private
   */
  this._tags = []

  // All entities are event emitters.
  EventEmitter.call(this)
}

/**
 * Re-init for pooling purposes.
 * @private
 */
Entity.prototype.__init = function () {
  this.id = nextId++
  this._manager = null
  this._Components.length = 0
  this._tags.length = 0
}

var nextId = 0

/**
 * @param {Function} TComponent
 * @return {Entity} This entity.
 */
Entity.prototype.addComponent = function (TComponent) {
  var args = Array.prototype.slice.call(arguments).slice(1)
  this._manager.entityAddComponent(this, TComponent, args)
  return this
}

/**
 * @param {Function} TComponent
 * @return {Entity} This entity.
 */
Entity.prototype.removeComponent = function (TComponent) {
  this._manager.entityRemoveComponent(this, TComponent)
  return this
}

/**
 * @param {Function} TComponent
 * @return {boolean} True if this entity has TComponent.
 */
Entity.prototype.hasComponent = function (TComponent) {
  return !!~this._Components.indexOf(TComponent)
}

/**
 * Drop all components.
 */
Entity.prototype.removeAllComponents = function () {
  return this._manager.entityRemoveAllComponents(this)
}

/**
 * @param {Array.<Function>} Components
 * @return {boolean} True if entity has all Components.
 */
Entity.prototype.hasAllComponents = function (Components) {
  var b = true

  for (var i = 0; i < Components.length; i++) {
    var C = Components[i]
    b &= !!~this._Components.indexOf(C)
  }

  return b
}

/**
 * @param {String} tag
 * @return {boolean} True if entity has tag.
 */
Entity.prototype.hasTag = function (tag) {
  return !!~this._tags.indexOf(tag)
}

/**
 * @param {String} tag
 * @return {Entity} This entity.
 */
Entity.prototype.addTag = function (tag) {
  this._manager.entityAddTag(this, tag)
  return this
}

/**
 * @param {String} tag
 * @return {Entity} This entity.
 */
Entity.prototype.removeTag = function (tag) {
  this._manager.entityRemoveTag(this, tag)
  return this
}

/**
 * Remove the entity.
 * @return {void}
 */
Entity.prototype.remove = function () {
  return this._manager.removeEntity(this)
}

},{"events":15,"util":19}],3:[function(require,module,exports){
module.exports = function () {
  return new EntityManager()
}

var Entity = require('./Entity.js')
var createPool = require('reuse-pool')
var getName = require('typedef').getName

/**
 * Manage, create, and destroy entities. Can use methods to mutate entities
 * (tags, components) directly or via the facade on the Entity.
 * @constructor
 */
function EntityManager () {
  /**
   * Map of tags to the list of their entities.
   * @private
   */
  this._tags = {}

  /**
   * @type {Array.<Entity>}
   * @private
   */
  this._entities = []

  /**
   * @type {Array.<Group>}
   * @private
   */
  this._groups = {}

  /**
   * Pool entities.
   * @private
   */
  this._entityPool = createPool(function () { return new Entity() })

  /**
   * Map of component names to their respective object pools.
   * @private
   */
  this._componentPools = {}

  /**
   * Map of component groups to group keys.
   * @private
   */
  this._groupKeyMap = new WeakMap()
}

/**
 * Used for indexing our component groups.
 * @constructor
 * @param {Array.<Function>} Components
 * @param {Array<Entity>} entities
 */
function Group (Components, entities) {
  this.Components = Components || []
  this.entities = entities || []
}

/**
 * Get a new entity.
 * @return {Entity}
 */
EntityManager.prototype.createEntity = function () {
  var entity = this._entityPool.get()

  this._entities.push(entity)
  entity._manager = this
  return entity
}

/**
 * Cleanly remove entities based on tag. Avoids loop issues.
 * @param {String} tag
 */
EntityManager.prototype.removeEntitiesByTag = function (tag) {
  var entities = this._tags[tag]

  if (!entities) return

  for (var x = entities.length - 1; x >= 0; x--) {
    var entity = entities[x]
    entity.remove()
  }
}

/**
 * Dump all entities out of the manager. Avoids loop issues.
 */
EntityManager.prototype.removeAllEntities = function () {
  for (var x = this._entities.length - 1; x >= 0; x--) {
    this._entities[x].remove()
  }
}

/**
 * Drop an entity. Returns it to the pool and fires all events for removing
 * components as well.
 * @param {Entity} entity
 */
EntityManager.prototype.removeEntity = function (entity) {
  var index = this._entities.indexOf(entity)

  if (!~index) {
    throw new Error('Tried to remove entity not in list')
  }

  this.entityRemoveAllComponents(entity)

  // Remove from entity list
  // entity.emit('removed')
  this._entities.splice(index, 1)

  // Remove entity from any tag groups and clear the on-entity ref
  entity._tags.length = 0
  for (var tag in this._tags) {
    var entities = this._tags[tag]
    var n = entities.indexOf(entity)
    if (~n) entities.splice(n, 1)
  }

  // Prevent any acecss and free
  entity._manager = null
  this._entityPool.recycle(entity)
  entity.removeAllListeners()
}

/**
 * @param {Entity} entity
 * @param {String} tag
 */
EntityManager.prototype.entityAddTag = function (entity, tag) {
  var entities = this._tags[tag]

  if (!entities) {
    entities = this._tags[tag] = []
  }

  // Don't add if already there
  if (~entities.indexOf(entity)) return

  // Add to our tag index AND the list on the entity
  entities.push(entity)
  entity._tags.push(tag)
}

/**
 * @param {Entity} entity
 * @param {String} tag
 */
EntityManager.prototype.entityRemoveTag = function (entity, tag) {
  var entities = this._tags[tag]
  if (!entities) return

  var index = entities.indexOf(entity)
  if (!~index) return

  // Remove from our index AND the list on the entity
  entities.splice(index, 1)
  entity._tags.splice(entity._tags.indexOf(tag), 1)
}

/**
 * @param {Entity} entity
 * @param {Function} Component
 */
EntityManager.prototype.entityAddComponent = function (entity, Component, args) {
  if (~entity._Components.indexOf(Component)) return

  entity._Components.push(Component)

  // Create the reference on the entity to this component
  var cName = componentPropertyName(Component)

  args = args || []
  entity[cName] = new Component(entity, ...args)

  entity[cName].entity = entity

  // Check each indexed group to see if we need to add this entity to the list
  for (var groupName in this._groups) {
    var group = this._groups[groupName]

    // Only add this entity to a group index if this component is in the group,
    // this entity has all the components of the group, and its not already in
    // the index.
    if (!~group.Components.indexOf(Component)) {
      continue
    }
    if (!entity.hasAllComponents(group.Components)) {
      continue
    }
    if (~group.entities.indexOf(entity)) {
      continue
    }

    group.entities.push(entity)
  }

  entity.emit('component added', Component)
}

/**
 * Drop all components on an entity. Avoids loop issues.
 * @param {Entity} entity
 */
EntityManager.prototype.entityRemoveAllComponents = function (entity) {
  var Cs = entity._Components

  for (var j = Cs.length - 1; j >= 0; j--) {
    var C = Cs[j]
    entity.removeComponent(C)
  }
}

/**
 * @param {Entity} entity
 * @param {Function} Component
 */
EntityManager.prototype.entityRemoveComponent = function (entity, Component) {
  var index = entity._Components.indexOf(Component)
  if (!~index) return

  entity.emit('component removed', Component)

  // Check each indexed group to see if we need to remove it
  for (var groupName in this._groups) {
    var group = this._groups[groupName]

    if (!~group.Components.indexOf(Component)) {
      continue
    }
    if (!entity.hasAllComponents(group.Components)) {
      continue
    }

    var loc = group.entities.indexOf(entity)
    if (~loc) {
      group.entities.splice(loc, 1)
    }
  }

  // Remove T listing on entity and property ref, then free the component.
  var propName = componentPropertyName(Component)
  entity._Components.splice(index, 1)
  delete entity[propName]
}

/**
 * Get a list of entities that have a certain set of components.
 * @param {Array.<Function>} Components
 * @return {Array.<Entity>}
 */
EntityManager.prototype.queryComponents = function (Components) {
  var group = this._groups[this._groupKey(Components)]

  if (!group) {
    group = this._indexGroup(Components)
  }

  return group.entities
}

/**
 * Get a list of entities that all have a certain tag.
 * @param {String} tag
 * @return {Array.<Entity>}
 */
EntityManager.prototype.queryTag = function (tag) {
  var entities = this._tags[tag]

  if (entities === undefined) {
    entities = this._tags[tag] = []
  }

  return entities
}

/**
 * @return {Number} Total number of entities.
 */
EntityManager.prototype.count = function () {
  return this._entities.length
}

/**
 * Create an index of entities with a set of components.
 * @param {Array.<Function>} Components
 * @private
 */
EntityManager.prototype._indexGroup = function (Components) {
  var key = this._groupKey(Components)

  if (this._groups[key]) return

  var group = this._groups[key] = new Group(Components)

  for (var n = 0; n < this._entities.length; n++) {
    var entity = this._entities[n]
    if (entity.hasAllComponents(Components)) {
      group.entities.push(entity)
    }
  }

  return group
}

/**
 * @param {Function} Component
 * @return {String}
 * @private
 */
function componentPropertyName (Component) {
  var name = getName(Component)
  if (!name) {
    throw new Error('Component property name is empty, ' +
                    'try naming your component function')
  }
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/**
 * @param {Array.<Function>} Components
 * @return {String}
 * @private
 */
EntityManager.prototype._groupKey = function (Components) {
  var cachedKey = this._groupKeyMap.get(Components)
  if (cachedKey) {
    return cachedKey
  }

  var names = []
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n]
    names.push(getName(T))
  }

  var key = names
    .map(function (x) { return x.toLowerCase() })
    .sort()
    .join('-')

  this._groupKeyMap.set(Components, key)

  return key
}

},{"./Entity.js":2,"reuse-pool":4,"typedef":5}],4:[function(require,module,exports){
var EMPTY = {};
var NO_OP = function() {};

module.exports = reusePool;
function reusePool(factory, opts) {
    return new ReusePool(factory, opts);
}

function ReusePool(factory, opts) {
    this._factory = factory;
    this._recycled = [];
    opts = opts || EMPTY;
    this._prepare = opts.prepare || NO_OP;
    this._max = opts.max || Infinity;
}

ReusePool.prototype.get = function() {
    if (this._recycled.length) {
        var obj = this._recycled.pop();
        this._prepare(obj);
        return obj;
    } else {
        return this._factory();
    }
}

ReusePool.prototype.recycle = function(obj) {
	if (this._recycled.length < this._max) {
		this._recycled.push(obj);	
	}
}

},{}],5:[function(require,module,exports){
module.exports = {

  'extends'      : require('./lib/extends.js'),
  'mixin'        : require('./lib/mixin.js'),
  'getArguments' : require('./lib/getArguments.js'),
  'getName'      : require('./lib/getName.js')

};



},{"./lib/extends.js":6,"./lib/getArguments.js":7,"./lib/getName.js":8,"./lib/mixin.js":9}],6:[function(require,module,exports){
module.exports = extends_;

/**
 * The well documented, oft-used (Coffeescript, Typescript, ES6... etc) extends
 * pattern to get some sort of single-inheritance in Javascript.  Modify a
 * Child class to have inherited the static members via copying and link the
 * prototypes.
 * @param {Function} Child Child constructor function.
 * @param {Function} Parent Parent contrusctor function.
 * @return {Function} The Child constructor.
 */
function extends_(Child, Parent)
{
  // Drop in statics
  for (var key in Parent) {
    if (!Child.hasOwnProperty(key) && Parent.hasOwnProperty(key)) {
      Child[key] = Parent[key];
    }
  }

  // Give static to access parent
  Child.Super = Parent;

  // Child's prototype property is an object with the parent's prototype
  // property its [[prototype]] + constructor
  if (Object.create instanceof Function) {
    Child.prototype = Object.create(Parent.prototype, {
      constructor: { value: Child }
    });
  } else {
    // IE8 and below shim
    var T = makeT(Child);
    T.prototype = Parent.prototype;
    Child.prototype = new T();
  }

  return Child;
}

/**
 * @param {Function} Child
 * @return {Function}
 */
function makeT(Child)
{
  return function T() { this.constructor = Child; };
}


},{}],7:[function(require,module,exports){
module.exports = getArguments;

var FUNCTION_ARGS = /^\w*function[^\(]*\(([^\)]+)/;

/**
 * Get the parameter names of a function.
 * @param {Function} f A function.
 * @return {Array.<String>} An array of the argument names of a function.
 */
function getArguments(f)
{
  var ret = [];
  var args = f.toString().match(FUNCTION_ARGS);

  if (args) {
    args = args[1]
      .replace(/[ ]*,[ ]*/, ',')
      .split(',');
    for (var n = 0; n < args.length; n++) {
      var a = args[n].replace(/^\s+|\s+$/g, '');
      if (a) ret.push(a);
    }
  }

  return ret;
}


},{}],8:[function(require,module,exports){
module.exports = getName;

var FUNCTION_NAME = /function\s+([^\s(]+)/;

/**
 * Get the name of a function (e.g. constructor)
 * @param {Function} f
 * @return {String} The function name.
 */
function getName(f)
{
  var name = '';

  if (f instanceof Function) {
    if (f.name) {
      return f.name;
    }

    var match = f.toString().match(FUNCTION_NAME);

    if (match) {
      name = match[1];
    }
  } else if (f && f.constructor instanceof Function) {
    name = getName(f.constructor);
  }

  return name;
}

},{}],9:[function(require,module,exports){
module.exports = mixin_;

/**
 * Add all own properties of mixin to the prototype property of class T
 * @param {Function} T Class we want to mix into.
 * @param {Function|Object} mixin Mixin we want to mixt
 */
function mixin_(T, mixin)
{
  // If we're mixing in a class (constructor function), then first mix in all
  // things hanging directly off the mixin as "statics", then switch the mixin
  // ref to point to the prototype
  if (mixin instanceof Function) {
    for (var k in mixin) {
      T[k] = mixin[k];
    }
    mixin = mixin.prototype;
  }

  // Dump everything on the mixin into the prototype of our class
  for (var key in mixin) {
    if (mixin.hasOwnProperty(key)) {
      T.prototype[key] = mixin[key];
    }
  }
}


},{}],10:[function(require,module,exports){
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


},{"./components/main":11,"./factories/main":12,"./systems/main":13,"nano-ecs":1}],11:[function(require,module,exports){


function Position(entity, x, y) {
  this.x = x;
  this.y = y;
};

function Sprite(entity, imgSrc) {
  this.img = imgSrc;
};

function SocketID(entity, id) {
  this.id = id
};

exports.Position = Position;
exports.SocketID = SocketID;

},{}],12:[function(require,module,exports){

function createPlayer(world, isUser, components, x, y, id = null) {
  var entity = world.createEntity();
  entity.addComponent(components.Position, x, y);
  if (!isUser) {
    entity.addComponent(components.SocketID, id);
  };
  entity.addTag("player");
  return entity;
};

exports.createPlayer = createPlayer;

},{}],13:[function(require,module,exports){
const physics = require("./physics");

},{"./physics":14}],14:[function(require,module,exports){

exports.movementSystem = (world) => {
  this.update = (dt, time) => {
    var candidates = world.queryComponents([Position]);
    candidates.forEach((entity) => {
      entity.x += 1;
      entity.y += 1;
    });
  };
};

},{}],15:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],16:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],17:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],18:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],19:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":18,"_process":16,"inherits":17}]},{},[10]);
