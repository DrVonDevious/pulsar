
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
