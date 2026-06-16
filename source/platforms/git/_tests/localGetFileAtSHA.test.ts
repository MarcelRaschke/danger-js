import { execFile } from "child_process"

import { localGetFileAtSHA } from "../localGetFileAtSHA"

jest.mock("child_process", () => ({
  __esModule: true,
  execFile: jest.fn((_cmd, _args, callback) => callback(null, "", "")),
}))

it("invokes git via execFile with an argv array (no shell)", async () => {
  await localGetFileAtSHA("src/index.ts", undefined, "abc123")

  expect(execFile).toHaveBeenCalledWith("git", ["show", "abc123:src/index.ts"], expect.any(Function))
})

it("passes a malicious file path as a single literal argument so it cannot inject commands", async () => {
  // A path crafted to break out of a quoted shell argument and run `touch`
  const evilPath = `x";touch /tmp/pwn;#/file.txt`

  await localGetFileAtSHA(evilPath, undefined, "master")

  // The whole `sha:path` must arrive as one argv entry — never split into a
  // shell command — so the metacharacters are inert.
  expect(execFile).toHaveBeenCalledWith("git", ["show", `master:${evilPath}`], expect.any(Function))
})
