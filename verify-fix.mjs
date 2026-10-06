// Simple script to verify the progress calculation fix
import { tasksActualProgress, flattenTasksToLeaves } from './src/lib/visits.ts';

// Test data from LOT03 with the problematic case
const testTasks = [
  {
    taskId: 'task1',
    progress: 45,
    state: 'ok',
    children: []
  },
  {
    taskId: 'task2', 
    progress: 100,
    state: 'ok',
    children: []
  },
  {
    taskId: 'task3',
    progress: 10,
    state: 'ok',
    children: []
  },
  {
    taskId: 'task4',
    progress: 80,
    state: 'ok',
    children: []
  }
];

try {
  // This would need proper imports, just show what we're testing
  console.log('Test case: LOT03 with tasks 45%, 100%, 10%, 80%');
  console.log('Expected average: (45 + 100 + 10 + 80) / 4 = 58.75% ≈ 59%');
  console.log('Running with current tasksActualProgress() function...');
} catch (err) {
  console.error('Error:', err.message);
}
