const { spawn } = require('child_process');
const path = require('path');

const predictMatch = (features) => {
  return new Promise((resolve, reject) => {
    const serverRoot = path.join(
      __dirname,
      '..'
    );
    const pythonScript = path.join(serverRoot, 'ml', 'predict_match.py');

    const pythonProcess = spawn(process.env.PYTHON_BIN || 'python', [
      pythonScript,
      JSON.stringify(features)
    ], { cwd: serverRoot });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            errorOutput || 'Random Forest prediction failed.'
          )
        );
      }

      try {
        const result = JSON.parse(output.trim());

        if (result.error) {
          return reject(new Error(result.error));
        }

        resolve(result);
      } catch (error) {
        reject(
          new Error(
            `Invalid response from Random Forest: ${output}`
          )
        );
      }
    });

    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
};

module.exports = {
  predictMatch
};
