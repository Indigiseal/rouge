// The frozen overlay is drawn centred on its card, and the boss one is mostly
// ground ice along its bottom. The Spider Queen's tall sprite has a web
// hanging up from the middle, so her feet sit well below the card centre:
// the ice is dropped to meet them (Taya). Every other card keeps it centred.
const SPIDER_QUEEN_ICE_DROP = 34;

/** How far below its card's centre the frozen overlay is drawn. */
export function frozenFrameOffsetY(data) {
    return data?.type === 'boss' && data.name === 'Spider Queen' ? SPIDER_QUEEN_ICE_DROP : 0;
}
