import utils from "../GitHubUtils"

import { readFileSync } from "fs"
import { resolve } from "path"

const fixtures = resolve(__dirname, "..", "..", "_tests", "fixtures")
const fixturedData = (path: string) => JSON.parse(readFileSync(`${fixtures}/${path}`, {}).toString())
const pr = fixturedData("github_pr.json")
const apiFake = {
  repos: {
    getContent: jest.fn(),
  },
} as any

describe("fileLinks", () => {
  it("Should convert a few paths into links", () => {
    const sut = utils(pr, apiFake)
    const links = sut.fileLinks(["a/b/c", "d/e/f"])
    const url = "https://github.com/orta/emission/blob/genevc/a/b/c"
    expect(links).toEqual(
      `<a href="${url}">c</a> and <a href="https://github.com/orta/emission/blob/genevc/d/e/f">f</a>`
    )
  })

  it("Should convert a few paths into links showing full links", () => {
    const sut = utils(pr, apiFake)
    const links = sut.fileLinks(["a/b/c", "d/e/f"], false)
    const url = "https://github.com/orta/emission/blob/genevc"
    expect(links).toEqual(`<a href="${url}/a/b/c">a/b/c</a> and <a href="${url}/d/e/f">d/e/f</a>`)
  })

  it("Should convert a few paths into links showing full link on a custom fork/branch", () => {
    const sut = utils(pr, apiFake)
    const links = sut.fileLinks(["a/b/c", "d/e/f"], false, "orta/emission", "new")
    const url = "https://github.com/orta/emission"

    expect(links).toEqual(`<a href="${url}/blob/new/a/b/c">a/b/c</a> and <a href="${url}/blob/new/d/e/f">d/e/f</a>`)
  })
})

describe("getContent", () => {
  it("should call the API's getContent", () => {
    const sut = utils(pr, apiFake)
    sut.fileContents("/a/b/c.ts")
    expect(apiFake.repos.getContent).toHaveBeenCalledWith({
      owner: "orta",
      path: "/a/b/c.ts",
      ref: "genevc",
      repo: "emission",
    })
  })
})
