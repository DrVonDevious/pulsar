

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
