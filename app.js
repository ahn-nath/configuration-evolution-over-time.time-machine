import { Octokit } from "octokit"
import fetch from 'node-fetch';

const octokit = new Octokit();

try {
  // TODO: check if the CSV file with all commit data exists, if not, create it and ignore the "since feature"
  // If it exist, retrieve the file locally and check the latest commit saved in the file (date). Write to it later

  // If it does not exist, write to new file and ignore the "since feature"
  let csvContent = "data:text/csv;charset=utf-8," + "city,temperature,timestamp" + "\n";
  since = "";

  // get all commits from the repository by owner and repo name
  // TODO: add more checks for API errors and rate limit
  const result = await octokit.request("GET /repos/{owner}/{repo}/commits?path={path}&since={since}", {
      owner: "ahn-nath",
      repo: "configuration-evolution-over-time.source-file",
      path: "city_temperature_track",
      since: since
    }); // TODO: include the path to the file of interest
  
  // retrieve all content URLS and dates of commits
  const urls = result.data.map(item => item.url)
  const dates = result.data.map(item => item.commit.author.date)

  //console.log("urls: ", urls)

  // each URL contains another address information about the content of the commit, which is in another link, we get it and access the content of the commit
  const commitsContents= await Promise.all(urls.map(async url => {
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
  console.log(commitsContents)

  // decode the content of the commit and split by line break
  console.log("DECODED CONTENT");
  for (let i = 0; i < commitsContents.length; i++) {
    let decodedContent = Buffer.from(commitsContents[i], 'base64').toString('ascii').split("\n")
    console.log(decodedContent)
    console.log(dates[i])

    //  for each loop of the decodedContent
    for(let j = 1; j < decodedContent.length; j++) {
        let line = decodedContent[j] + "," + dates[i] + "\n";
        csvContent += line;
        console.log(line)
  }
}

// export CSV file
  var encodedUri = encodeURI(csvContent);
  window.open(encodedUri);



} catch (error) {
  console.log(`Error! Status: ${error.status}. Message: ${error.response}`)
}


// Write a message to the console.
console.log('hello world!');
