import { Octokit } from "octokit"
import fetch from 'node-fetch';
import fs from 'fs';

const octokit = new Octokit();

async function generateCSVFilebyLatestCommitsTracked(debug=false) {
  try {
    // TODO: check if the CSV file with all commit data exists, if not, create it and ignore the "since feature"
    // If it exist, retrieve the file locally and check the latest commit saved in the file (date). Write to it later

    // If it does not exist, write to new file and ignore the "since feature"
    let csvContent = "city,temperature,timestamp\n";
    let since = "2023-03-16T00:00:00Z";

    // get all commits from the repository by owner and repo name
    if(!debug) {
      // TODO: add more checks for API errors and rate limit
      const result = await octokit.request("GET /repos/{owner}/{repo}/commits?path={path}&since={since}", {
          owner: "ahn-nath",
          repo: "configuration-evolution-over-time.source-file",
          path: "city_temperature_track",
          since: since
        });
      
      // retrieve all content URLS and dates of commits
      const urls = result.data.map(item => item.url)
      var dates = result.data.map(item => item.commit.author.date)
      
      // each URL contains another address information about the content of the commit, which is in another link, we get it and access the content of the commit
      var commitsContents= await Promise.all(urls.map(async url => {
        // 1. fetch URL in JSON that contains content-related data about the commit
        const response = await (await fetch(url)).text();
        const body = JSON.parse(response);
        // 2. fetch the JSON with encoded content of the commit
        const contentsURLText = await (await fetch(body.files[0].contents_url)).text();
        const content = JSON.parse(contentsURLText);
        // 3. return the encoded content of the commit
        return content.content;
      }
      ))

  } else {
      var dates = ["2023-03-17T01:34:24Z",]
      var commitsContents = ["Y2l0eSx0ZW1wZXJhdHVyZQpHcmFuZCBGb3JrcywtNDEKQmVybGluLDQuMQpP\nb2RuYWRhdHRhLDQxCg==\n"]
  }

    let decodedContent = Buffer.from(commitsContents[0], 'base64').toString('ascii')
    console.log(decodedContent)

    // decode the content of the commit and split by line break
    console.log("DECODED CONTENT");
    for (let i = 0; i < commitsContents.length; i++) {
      let decodedContent = Buffer.from(commitsContents[i], 'base64').toString('ascii').split("/\r?\n/");
      console.log(`decodedContentCommit: ${decodedContent}`)
      console.log(`datesCommit: ${dates[i]}`)

      //  for each loop of the decodedContent
      for(let j = 1; j < decodedContent.length; j++) {
        // if line is not empty
        // TODO: here we could use a regex that checks if the first part of the string is a city name in English or Spanish, followed by a comma and a positive or negative number
        // regex example: /^[a-zA-Z]+,[-+]?[0-9]*\.?[0-9]+$/
        if(decodedContent[j] != "") {
          // add the date of the commit to the line
          let line = decodedContent[j] + "," + dates[i] + "\n";
          csvContent += line;
          console.log(`line: ${line}`)
        }
    }
  }

    // export CSV file
    fs.writeFile("city_temperature_data.csv", csvContent, (err) => {
      console.log(err || "We have successfully updated the CSV file!");
    });

  } catch (error) {
    console.log(`Error! Status: ${error.status}. Message: ${error}`)
  }

}

// run file
generateCSVFilebyLatestCommitsTracked(true);

