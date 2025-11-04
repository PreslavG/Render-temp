<div className="pomodoro">
          <h1 className="pomodoroTitle">Pomodoro timer</h1>
          <h1 className="pomodoroTimer">{formatTime(timeLeft)}</h1>
            <button
              className="startPomodoro"
              onClick={() => setIsRunning(true)}
              disabled={isRunning}
            >
            Start
           </button>
             {showPopup && (
            <div className="pomodoroPopup">
                 <div className="popupContent">
            <h2>⏰ Time’s Up!</h2>
             <p>You can either continue learning or take a small break!</p>
             <p>The choice is yours</p>
            <button onClick={resetTimer}>Continue</button>
            <button onClick={takeaBreak}>5 mins</button>
            <button onClick={takeaBreak}>15 mins</button>
          </div>
        </div>
      )}
    </div>