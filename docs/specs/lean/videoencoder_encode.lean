import Std

namespace WebCodecs

inductive EncoderLifecycleState where
  | unconfigured
  | configured
  | closed
  deriving BEq, Repr, DecidableEq

inductive DomException where
  | typeError
  | invalidStateError
  | dataError
  | encodingError
  | abortError
  | notSupportedError
  deriving BEq, Repr, DecidableEq

structure Orientation where
  rotation : Nat
  flip : Bool
  deriving BEq, Repr, DecidableEq

structure VideoFrame where
  detached : Bool
  rotation : Nat
  flip : Bool
  timestamp : Option Int
  duration : Option Int
  resourceRef : Nat
  deriving BEq, Repr, DecidableEq

structure EncodeOptions where
  keyFrame : Bool
  deriving BEq, Repr, DecidableEq

inductive EncodedVideoChunkType where
  | key
  | delta
  deriving BEq, Repr, DecidableEq

structure EncodedVideoChunk where
  data : List Nat
  chunkType : EncodedVideoChunkType
  timestamp : Option Int
  duration : Option Int
  deriving BEq, Repr, DecidableEq

inductive AlphaMode where
  | keep
  | discard
  deriving BEq, Repr, DecidableEq

structure ScalabilityMode where
  temporalLayers : Nat
  deriving BEq, Repr, DecidableEq

structure EncoderConfig where
  codec : String
  width : Nat
  height : Nat
  displayWidth : Nat
  displayHeight : Nat
  scalabilityMode : ScalabilityMode
  alpha : AlphaMode
  deriving BEq, Repr, DecidableEq

structure VideoDecoderConfig where
  codec : String
  codedWidth : Nat
  codedHeight : Nat
  displayAspectWidth : Nat
  displayAspectHeight : Nat
  rotation : Nat
  flip : Bool
  codecExtra : Option String
  deriving BEq, Repr, DecidableEq

structure SvcOutputMetadata where
  temporalLayerId : Nat
  deriving BEq, Repr, DecidableEq

structure EncodedVideoChunkMetadata where
  decoderConfig : Option VideoDecoderConfig
  svc : Option SvcOutputMetadata
  alphaSideData : Option (List Nat)
  deriving BEq, Repr, DecidableEq

structure OutputEvent where
  chunk : EncodedVideoChunk
  metadata : EncodedVideoChunkMetadata
  deriving BEq, Repr, DecidableEq

structure EncodedOutput where
  data : List Nat
  chunkType : EncodedVideoChunkType
  frame : VideoFrame
  temporalLayerId : Option Nat
  alphaSideData : Option (List Nat)
  codecExtra : Option String
  deriving BEq, Repr, DecidableEq

inductive Task where
  | fireDequeueEvent
  | outputEncodedVideoChunks (outputs : List EncodedOutput)
  | closeVideoEncoder (ex : DomException)
  | clearSaturationAndProcessQueue
  deriving BEq, Repr, DecidableEq

inductive CodecWorkItem where
  | encode (frame : VideoFrame) (options : EncodeOptions)
  deriving BEq, Repr, DecidableEq

inductive ControlMessage where
  | encode (frame : VideoFrame) (options : EncodeOptions)
  deriving BEq, Repr, DecidableEq

inductive MessageOutcome where
  | processed
  | notProcessed
  deriving BEq, Repr, DecidableEq

structure CodecState where
  saturated : Bool
  extraConfig : Option String
  deriving BEq, Repr, DecidableEq

structure CodecEncodeResult where
  state : CodecState
  outputs : List EncodedOutput
  error : Option DomException
  deriving BEq, Repr, DecidableEq

structure CodecOps where
  willSaturate : CodecState -> VideoFrame -> EncodeOptions -> Bool
  encode : CodecState -> VideoFrame -> EncodeOptions -> CodecEncodeResult

structure VideoEncoderState where
  state : EncoderLifecycleState
  activeOrientation : Option Orientation
  encodeQueueSize : Nat
  controlMessageQueue : List ControlMessage
  messageQueueBlocked : Bool
  codecSaturated : Bool
  codecState : CodecState
  codecWorkQueue : List CodecWorkItem
  dequeueEventScheduled : Bool
  pendingFlushPromises : List Nat
  rejectedFlushPromises : List (Prod Nat DomException)
  activeEncoderConfig : Option EncoderConfig
  activeOutputConfig : Option VideoDecoderConfig
  taskQueue : List Task
  outputEvents : List OutputEvent
  errorEvents : List DomException
  nextResourceId : Nat
  deriving BEq, Repr, DecidableEq


def orientationOf (frame : VideoFrame) : Orientation :=
  { rotation := frame.rotation, flip := frame.flip }


def orientationMatches (a : Orientation) (b : Orientation) : Bool :=
  a.rotation == b.rotation && a.flip == b.flip


def cloneVideoFrame (st : VideoEncoderState) (frame : VideoFrame) : Prod VideoFrame VideoEncoderState :=
  let clone := { frame with resourceRef := st.nextResourceId }
  let st' := { st with nextResourceId := st.nextResourceId + 1 }
  (clone, st')


def queueControlMessage (st : VideoEncoderState) (msg : ControlMessage) : VideoEncoderState :=
  { st with controlMessageQueue := st.controlMessageQueue ++ [msg] }


def queueTask (st : VideoEncoderState) (task : Task) : VideoEncoderState :=
  { st with taskQueue := st.taskQueue ++ [task] }


def scheduleDequeueEvent (st : VideoEncoderState) : VideoEncoderState :=
  if st.dequeueEventScheduled then
    st
  else
    queueTask { st with dequeueEventScheduled := true } Task.fireDequeueEvent


def makeOutputConfig (encCfg : EncoderConfig) (frame : VideoFrame) (codecExtra : Option String)
    : VideoDecoderConfig :=
  { codec := encCfg.codec
    codedWidth := encCfg.width
    codedHeight := encCfg.height
    displayAspectWidth := encCfg.displayWidth
    displayAspectHeight := encCfg.displayHeight
    rotation := frame.rotation
    flip := frame.flip
    codecExtra := codecExtra }


def outputEncodedVideoChunks (st : VideoEncoderState) (outputs : List EncodedOutput)
    : VideoEncoderState :=
  let rec go (st' : VideoEncoderState) (outs : List EncodedOutput) : VideoEncoderState :=
    match outs with
    | [] => st'
    | out :: rest =>
        match st'.activeEncoderConfig with
        | none => go st' rest
        | some encCfg =>
            let chunk : EncodedVideoChunk :=
              { data := out.data
                chunkType := out.chunkType
                timestamp := out.frame.timestamp
                duration := out.frame.duration }
            let outputConfig := makeOutputConfig encCfg out.frame out.codecExtra
            let (decoderConfigOpt, st'') :=
              match st'.activeOutputConfig with
              | none => (some outputConfig, { st' with activeOutputConfig := some outputConfig })
              | some activeCfg =>
                  if outputConfig == activeCfg then
                    (none, st')
                  else
                    (some outputConfig, { st' with activeOutputConfig := some outputConfig })
            let svc :=
              if encCfg.scalabilityMode.temporalLayers > 1 then
                let layerId := Option.getD out.temporalLayerId 0
                some { temporalLayerId := layerId }
              else
                none
            let alphaSideData :=
              match encCfg.alpha with
              | .keep => out.alphaSideData
              | .discard => none
            let metadata : EncodedVideoChunkMetadata :=
              { decoderConfig := decoderConfigOpt
                svc := svc
                alphaSideData := alphaSideData }
            let event : OutputEvent :=
              { chunk := chunk
                metadata := metadata }
            let st''' := { st'' with outputEvents := st''.outputEvents ++ [event] }
            go st''' rest
  go st outputs


def resetVideoEncoder (st : VideoEncoderState) (ex : DomException)
    : Except DomException VideoEncoderState :=
  if st.state == .closed then
    Except.error DomException.invalidStateError
  else
    let st1 :=
      { st with
        state := .unconfigured
        activeEncoderConfig := none
        activeOutputConfig := none
        controlMessageQueue := []
        messageQueueBlocked := false
        codecSaturated := false
        codecWorkQueue := [] }
    let st2 :=
      if st1.encodeQueueSize > 0 then
        scheduleDequeueEvent { st1 with encodeQueueSize := 0 }
      else
        st1
    let rejected :=
      st2.pendingFlushPromises.map (fun pid => (pid, ex))
    let st3 :=
      { st2 with
        pendingFlushPromises := []
        rejectedFlushPromises := st2.rejectedFlushPromises ++ rejected }
    Except.ok st3


def closeVideoEncoder (st : VideoEncoderState) (ex : DomException) : VideoEncoderState :=
  match resetVideoEncoder st ex with
  | .error _ => st
  | .ok st' =>
      let st'' := { st' with state := .closed, codecState := { saturated := false, extraConfig := none } }
      if ex == .abortError then
        st''
      else
        { st'' with errorEvents := st''.errorEvents ++ [ex] }


def runControlMessage (ops : CodecOps) (st : VideoEncoderState) (msg : ControlMessage)
    : Prod MessageOutcome VideoEncoderState :=
  match msg with
  | .encode frame options =>
      if st.codecSaturated then
        (.notProcessed, st)
      else
        let st1 :=
          if ops.willSaturate st.codecState frame options then
            { st with codecSaturated := true }
          else
            st
        let st2 := { st1 with encodeQueueSize := Nat.pred st1.encodeQueueSize }
        let st3 := scheduleDequeueEvent st2
        let st4 := { st3 with codecWorkQueue := st3.codecWorkQueue ++ [CodecWorkItem.encode frame options] }
        (.processed, st4)


def processControlMessageQueueFuel (ops : CodecOps) (fuel : Nat) (st : VideoEncoderState)
    : VideoEncoderState :=
  match fuel with
  | 0 => st
  | Nat.succ rest =>
      if st.messageQueueBlocked then
        st
      else
        match st.controlMessageQueue with
        | [] => st
        | msg :: tail =>
            let (outcome, st') := runControlMessage ops st msg
            match outcome with
            | .notProcessed => st'
            | .processed =>
                let st'' := { st' with controlMessageQueue := tail }
                processControlMessageQueueFuel ops rest st''


def processControlMessageQueue (ops : CodecOps) (st : VideoEncoderState) : VideoEncoderState :=
  processControlMessageQueueFuel ops st.controlMessageQueue.length st


def runCodecWorkItem (ops : CodecOps) (st : VideoEncoderState) (item : CodecWorkItem)
    : VideoEncoderState :=
  match item with
  | .encode frame options =>
      let result := ops.encode st.codecState frame options
      let st1 := { st with codecState := result.state }
      match result.error with
      | some _ => queueTask st1 (Task.closeVideoEncoder .encodingError)
      | none =>
          let st2 :=
            if st.codecSaturated && !result.state.saturated then
              queueTask st1 Task.clearSaturationAndProcessQueue
            else
              st1
          if result.outputs.isEmpty then
            st2
          else
            queueTask st2 (Task.outputEncodedVideoChunks result.outputs)


def runCodecWorkQueueOne (ops : CodecOps) (st : VideoEncoderState) : VideoEncoderState :=
  match st.codecWorkQueue with
  | [] => st
  | item :: rest =>
      let st' := { st with codecWorkQueue := rest }
      runCodecWorkItem ops st' item


def runTask (ops : CodecOps) (st : VideoEncoderState) (task : Task) : VideoEncoderState :=
  match task with
  | .fireDequeueEvent => { st with dequeueEventScheduled := false }
  | .outputEncodedVideoChunks outputs => outputEncodedVideoChunks st outputs
  | .closeVideoEncoder ex => closeVideoEncoder st ex
  | .clearSaturationAndProcessQueue =>
      let st' := { st with codecSaturated := false }
      processControlMessageQueue ops st'


def runTaskQueueFuel (ops : CodecOps) (fuel : Nat) (st : VideoEncoderState) : VideoEncoderState :=
  match fuel with
  | 0 => st
  | Nat.succ rest =>
      match st.taskQueue with
      | [] => st
      | task :: tail =>
          let st' := { st with taskQueue := tail }
          let st'' := runTask ops st' task
          runTaskQueueFuel ops rest st''


def runTaskQueue (ops : CodecOps) (st : VideoEncoderState) : VideoEncoderState :=
  runTaskQueueFuel ops st.taskQueue.length st


def encode (ops : CodecOps) (st : VideoEncoderState) (frame : VideoFrame)
    (options : EncodeOptions) : Except DomException VideoEncoderState :=
  if frame.detached then
    Except.error DomException.typeError
  else if st.state != .configured then
    Except.error DomException.invalidStateError
  else
    match st.activeOrientation with
    | some orientation =>
        if orientationMatches orientation (orientationOf frame) then
          let (frameClone, st1) := cloneVideoFrame st frame
          let st2 := { st1 with encodeQueueSize := st1.encodeQueueSize + 1 }
          let st3 := queueControlMessage st2 (ControlMessage.encode frameClone options)
          let st4 := processControlMessageQueue ops st3
          Except.ok st4
        else
          Except.error DomException.dataError
    | none =>
        let st1 := { st with activeOrientation := some (orientationOf frame) }
        let (frameClone, st2) := cloneVideoFrame st1 frame
        let st3 := { st2 with encodeQueueSize := st2.encodeQueueSize + 1 }
        let st4 := queueControlMessage st3 (ControlMessage.encode frameClone options)
        let st5 := processControlMessageQueue ops st4
        Except.ok st5


-- Minimal executable example. Replace sampleCodecOps with a real model.

def sampleCodecOps : CodecOps :=
  { willSaturate := fun _ _ _ => false
    encode := fun state frame _ =>
      let output : EncodedOutput :=
        { data := []
          chunkType := .key
          frame := frame
          temporalLayerId := some 0
          alphaSideData := none
          codecExtra := state.extraConfig }
      { state := state
        outputs := [output]
        error := none } }


def sampleState : VideoEncoderState :=
  { state := .configured
    activeOrientation := none
    encodeQueueSize := 0
    controlMessageQueue := []
    messageQueueBlocked := false
    codecSaturated := false
    codecState := { saturated := false, extraConfig := none }
    codecWorkQueue := []
    dequeueEventScheduled := false
    pendingFlushPromises := []
    rejectedFlushPromises := []
    activeEncoderConfig :=
      some
        { codec := "vp8"
          width := 640
          height := 360
          displayWidth := 640
          displayHeight := 360
          scalabilityMode := { temporalLayers := 1 }
          alpha := .discard }
    activeOutputConfig := none
    taskQueue := []
    outputEvents := []
    errorEvents := []
    nextResourceId := 1 }


def sampleFrame : VideoFrame :=
  { detached := false
    rotation := 0
    flip := false
    timestamp := some 0
    duration := some 33333
    resourceRef := 0 }


def sampleOptions : EncodeOptions := { keyFrame := false }


def exampleEncode : Except DomException VideoEncoderState :=
  encode sampleCodecOps sampleState sampleFrame sampleOptions

end WebCodecs
