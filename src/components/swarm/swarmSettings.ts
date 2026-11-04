export const swarmSettings = {
  speed: {
    cursorMovement: 1.8,
    acceleration: 1.6,
    toolCollectionDuration: 0.6,
    drawingDuration: 0.65,
    typingInterval: 0.5,
    stylingDuration: 0.6,
    idleDelay: 0.4,
  },
  timing: {
    scrollSpeed: 200,
    resumeDelay: 4500,
    textCharacterDelay: 38,
    entryDuration: 600,
    entryDurationStagger: 70,
    toolPickupDuration: 260,
    toolPickupStagger: 35,
    minimumTravelDuration: 240,
    travelSpeedScale: 0.7,
    returnStagger: 9,
  },
} as const
