const fs = require('fs');
const childProcess = require('child_process');
const { exit } = require('process');

const pkgFile = './package.json';
const pkgFileContent = fs.readFileSync(pkgFile);
const pkg = JSON.parse(pkgFileContent);
const version = pkg.version.split('.');
const patch = parseInt(version.at(-1));
const nextVersion = [...version.slice(0, -1), patch + 1].join('.');
pkg.version = nextVersion;

console.log(`upgrade from ${version.join('.')} -> ${nextVersion}`);
console.log(`add tag: v${nextVersion}`);
childProcess.exec(`git tag -a v${nextVersion} -m "v${nextVersion}"`, (error, stdout, stderr) => {
  if (error) {
    childProcess.exec(`git tag -d v${nextVersion}`);
    console.error(`exec error: ${error}`);
    exit(-1);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
});

childProcess.exec(`git push origin --tags`, (error, stdout, stderr) => {
  if (error) {
    childProcess.exec(`git tag -d v${nextVersion}`);
    console.error(`exec error: ${error}`);
    exit(-1);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
});

fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
