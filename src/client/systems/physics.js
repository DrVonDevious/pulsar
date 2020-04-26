
exports.movementSystem = (world) => {
  this.update = (dt, time) => {
    var candidates = world.queryComponents([Position]);
    candidates.forEach((entity) => {
      entity.x += 1;
      entity.y += 1;
    });
  };
};
