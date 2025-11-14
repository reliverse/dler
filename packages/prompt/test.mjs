import { inputPrompt, selectPrompt, multiselectPrompt } from './dist/index.js';

console.log('Testing inputPrompt...');
try {
  const result = inputPrompt("Enter your name: ", {
    required: true,
    echoMode: 'normal'
  });
  console.log('Result:', result);
} catch (error) {
  console.error('Error:', error);
}

console.log('\nTesting selectPrompt...');
try {
  const result = selectPrompt([
    { text: 'Option 1', description: 'First option' },
    { text: 'Option 2', description: 'Second option' },
    { text: 'Option 3', description: 'Third option' }
  ], {
    headerText: 'Choose an option:',
    perPage: 3
  });
  console.log('Result:', result);
} catch (error) {
  console.error('Error:', error);
}

console.log('\nTesting multiselectPrompt...');
try {
  const result = multiselectPrompt([
    { text: 'Option 1', description: 'First option' },
    { text: 'Option 2', description: 'Second option' },
    { text: 'Option 3', description: 'Third option' }
  ], {
    headerText: 'Choose multiple options:',
    perPage: 3
  });
  console.log('Result:', result);
} catch (error) {
  console.error('Error:', error);
}

