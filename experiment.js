import { Octokit } from "octokit"
import * as dotenv from 'dotenv';


const octokit = new Octokit({ auth: process.env.GITHUB_API_TOKEN });
//dotenv.config()


let result = await octokit.request("GET /orgs/octokit/repos", {});
console.log("OK")
console.log(result)