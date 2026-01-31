# Timer/Stopwatch Component

Create a Svelte 5 timer with:
- Start/Pause/Reset controls
- Lap recording
- Display in MM:SS.ms format
- Optional countdown mode

## Requirements

1. **Timer State**: Track elapsed time in milliseconds
2. **Controls**: 
   - Start button to begin counting
   - Pause button to stop counting (preserves elapsed time)
   - Reset button to clear timer and laps
   - Lap button to record current time
3. **Display**: Show time in MM:SS.ms format (e.g., "01:30.50" for 1 minute, 30 seconds, 500 milliseconds)
4. **Laps**: Store and display list of recorded lap times

## Technical Requirements

- Use `$state()` for reactive state (elapsed time, running status, laps array)
- Use `$derived()` for computed values (formatted time display)
- Use `$effect()` with proper cleanup for the interval timer
- The interval should update every 10ms for smooth display
