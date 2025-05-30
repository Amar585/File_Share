import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const excludeList = [
  'node_modules',
  '.git',
  '.next',
  '.env',
  '.env.local',
  '.env.*',
  '*.log',
  'project-for-professor.zip',
  'temp-project'
];

const tempDir = 'temp-project';

try {
  // Create temporary directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Copy project files to temporary directory
  const copyCommand = `powershell Copy-Item * ${tempDir} -Recurse -Force -Exclude ${excludeList.map(item => `"${item}"`).join(',')}`;
  
  exec(copyCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error copying files: ${error}`);
      return;
    }

    // Create zip from temporary directory
    const zipCommand = `powershell Compress-Archive -Path "${tempDir}/*" -DestinationPath project-for-professor.zip -Force`;
    
    exec(zipCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error creating archive: ${error}`);
        return;
      }

      // Clean up temporary directory
      const cleanupCommand = 'powershell Remove-Item -Path temp-project -Recurse -Force';
      exec(cleanupCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error cleaning up: ${error}`);
          return;
        }
        console.log('Project archive created successfully: project-for-professor.zip');
      });
    });
  });
} catch (error) {
  console.error(`Failed to create archive: ${error}`);
}
