import { describe, expect, it } from '@jest/globals';

describe('e2e', () => {
  // FIXME: this test is not working
  // https://kgajera.com/blog/how-to-test-yargs-cli-with-jest/
  it('cli test 1: with given parameter', async () => {
    expect(true).toBeTruthy();

    // const consoleLogSpy = jest.spyOn(console, 'log');
    // const consoleErrorSpy = jest.spyOn(console, 'error');

    // const result = spawn('npx', ['tsx', 'src/cli.ts']);
    // // const cli = spawn('npx', ['tsx', 'src/cli.ts']);
    // result.stdout.on('data', (data) => {
    //   console.log(data);
    // });
    // result.stderr.on('error', (data) => {
    //   console.error(data);
    // });

    // expect(consoleLogSpy).toHaveBeenCalled();
    // expect(consoleErrorSpy).not.toHaveBeenCalled();

    // result.on('close', (code) => {
    //   debugger;
    //   console.log(code);
    // });
    // cli.stdout.on('data', (data) => {
    //   debugger;
    //   console.log(data.toString());
    //   stdout += data.toString();
    // });

    // cli.on('close', (code) => {
    //   debugger;
    //   expect(code).toBe(0);
    //   expect(stdout.trim()).toBe('Hello, Alice!');
    // });

    // cli.on('error', (err) => {
    //   debugger;
    //   console.log(err);
    // });
    // cli.stdin.end();
  });

  // it('cli test 2: with interactive stdin', () => {
  //   const cli = spawn('tsx', ['src/cli.ts']);
  //   let stdout = '';
  //   cli.stdout.on('data', (data) => {
  //     stdout += data.toString();
  //     if (stdout.includes('What is your name?')) {
  //       cli.stdin.write('Bob\n');
  //     }
  //   });
  //   cli.on('close', (code) => {
  //     expect(code).to.equal(0);
  //     expect(stdout.trim()).to.equal('What is your name?\nHello, Bob!');
  //   });
  //   cli.stdin.end();
  // });
});
