export function snapOriginToPixelGrid(gameObject) {
    if (!gameObject?.setOrigin) return gameObject;

    const frame = gameObject.frame;
    const width = frame?.width || gameObject.width || 0;
    const height = frame?.height || gameObject.height || 0;
    if (!width || !height) return gameObject;

    const originX = width % 2 === 0 ? 0.5 : Math.floor(width / 2) / width;
    const originY = height % 2 === 0 ? 0.5 : Math.floor(height / 2) / height;
    gameObject.setOrigin(originX, originY);
    return gameObject;
}
