function required(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Required UI element not found: ${selector}`);
  return element;
}

function all(selector) {
  return [...document.querySelectorAll(selector)];
}

export function getElements() {
  return Object.freeze({
    machine: required("#machine"),
    machineTitle: required("#machineTitle"),
    machineSubtitle: required("#machineSubtitle"),
    modeButtons: all("[data-mode]"),
    themeButtons: all("[data-theme-choice]"),
    difficultyButtons: all("[data-difficulty]"),
    settingsButton: required("#settingsButton"),
    settingsPanel: required("#settingsPanel"),
    showGuide: required("#showGuide"),
    resetProgress: required("#resetProgress"),
    settingsMeasure: required("#settingsMeasure"),
    settingsMeasured: required("#settingsMeasured"),

    guide: required("#guide"),
    guideSteps: all("[data-guide-step]"),
    guideDots: all("[data-guide-dot]"),
    guideNext: all("[data-guide-next]"),
    guideBack: all("[data-guide-back]"),
    guideSkip: all("[data-guide-skip]"),
    guideThemes: all("[data-guide-theme]"),
    guideSpeeds: all("[data-guide-speed]"),
    guideHear: all("[data-guide-hear]"),
    firstSignalButton: required("#firstSignalButton"),
    firstSignalPattern: required("#firstSignalPattern"),
    firstSignalState: required("#firstSignalState"),
    finishGuide: required("#finishGuide"),

    rhythmChoose: required("#rhythmChoose"),
    measureStart: required("#measureStart"),
    measureCaption: required("#measureCaption"),
    measureResult: required("#measureResult"),
    measurePanel: required("#measurePanel"),
    measureMarks: required("#measureMarks"),
    measureGroups: all("[data-signal]"),
    measureReplay: required("#measureReplay"),
    measureSame: required("#measureSame"),
    measureDifferent: required("#measureDifferent"),
    measureFeedback: required("#measureFeedback"),
    measureProgress: required("#measureProgress"),
    measureBar: required("#measureBar"),

    primaryStatLabel: required("#primaryStatLabel"),
    primaryStat: required("#primaryStat"),
    accuracyStat: required("#accuracyStat"),
    streakStat: required("#streakStat"),

    letters: required("#letters"),
    lettersList: required("#lettersList"),
    lettersCount: required("#lettersCount"),
    lettersNext: required("#lettersNext"),
    lettersToggle: required("#lettersToggle"),
    sheetScrim: required("#sheetScrim"),
    sessionScore: required("#sessionScore"),
    bestScore: required("#bestScore"),
    lettersMemory: required("#lettersMemory"),

    introCard: required("#introCard"),
    introTag: required("#introTag"),
    introLetter: required("#introLetter"),
    introSignal: required("#introSignal"),
    introSpoken: required("#introSpoken"),
    introNote: required("#introNote"),
    introHear: required("#introHear"),
    introGotIt: required("#introGotIt"),

    contactCard: required("#contactCard"),
    contactSignal: required("#contactSignal"),
    contactReplay: required("#contactReplay"),
    contactContinue: required("#contactContinue"),

    arrivalCard: required("#arrivalCard"),
    arrivalPrimary: required("#arrivalPrimary"),
    arrivalSecondary: required("#arrivalSecondary"),
    arrivalStart: required("#arrivalStart"),

    sessionCard: required("#sessionCard"),
    sessionTag: required("#sessionTag"),
    sessionSentence: required("#sessionSentence"),
    sessionContinue: required("#sessionContinue"),
    sessionRail: required("#sessionRail"),
    sessionPhase: required("#sessionPhase"),

    practiceView: required("#practiceView"),
    sprintPanel: required("#sprintPanel"),
    clock: required("#clock"),
    sprintScore: required("#sprintScore"),
    timeTrack: required(".time-track"),
    timeBar: required("#timeBar"),
    statusLine: required("#statusLine"),
    signalButton: required("#signalButton"),
    signalText: required("#signalText"),
    signalBars: required("#signalBars"),
    typedAnswer: required("#typedAnswer"),
    replayButton: required("#replayButton"),
    mainAction: required("#mainAction"),
    answerDeck: required("#answerDeck"),
    answerGrid: required("#answerGrid"),

    sendView: required("#sendView"),
    sendStatus: required("#sendStatus"),
    sendTargetLabel: required("#sendTargetLabel"),
    sendReplay: required("#sendReplay"),
    sendPad: required("#sendPad"),
    sendPadLabel: required("#sendPadLabel"),
    sendSequence: required("#sendSequence"),
    sendDecode: required("#sendDecode"),
    sendClear: required("#sendClear"),
    sendCheck: required("#sendCheck"),
    sendTrace: required("#sendTrace"),
    sendBand: required("#sendBand"),

    footerMode: required("#footerMode"),
    keyboardHelp: required("#keyboardHelp"),
    footerResult: required("#footerResult"),
    liveStatus: required("#liveStatus"),
  });
}
