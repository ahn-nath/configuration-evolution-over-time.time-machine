import test from 'ava';
import { Octokit } from "octokit"


// TODOs:
// Simple documentation for all functions

//***/ General test
// - Add a test for the "debug" option when it is true
// - Add a test to check the GitHub API works and is enabled
test('GitHub API works with authentication details', async t => {

    const octokit = new Octokit({ auth: process.env.GITHUB_API_TOKEN });
    const result = await octokit.request("GET /repos/{owner}/{repo}/commits", {
        owner: "ahn-nath",
        repo: "configuration-evolution-over-time.source-file",
        });

        t.is(result.status, 200);
});

//***/ Since and last date tests
// - Add a test for the "since" option when the date is empty
// - Add a test for the "since" option when the date is not empty
// - Add a test for the "since" option when the date is in wrong format

//***/ Commits tests
// - Add a test for an invalid line in a commit



            
   

    