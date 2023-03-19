import { Octokit } from "octokit"
import fetch from 'node-fetch';
import fs from 'fs';

const octokit = new Octokit();
const created_date = "2023-03-16T00:00:00Z"

async function generateCSVFilebyLatestCommitsTracked(debug=false) {
  try {
    // initialize variables with default values and attempt to get the date and file
    let csvContent = "city,temperature,timestamp\n";
    let since = created_date;
    const last_date_json = JSON.parse(fs.readFileSync("last_date.json", "utf8"));
    const fileExist = fs.existsSync('city_temperature_data.csv');

    // if the file exists and the date is valid, we read the file and get the date of the latest commit tracked to write to existing file and get new data
    if (fileExist  && (last_date_json["last_date"] && moment(last_date_json["last_date"], "YYYY/MM/DDTHH:MM:SSZ", true).isValid())) {
      csvContent = fs.readFileSync("city_temperature_data.csv", "utf8");
      since = last_date_json;
      console.log(city_temperature_file)
    }

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

    // decode the commit content (base64) and split by line break
    for (let i = 0; i < commitsContents.length; i++) {
      let decodedContent = Buffer.from(commitsContents[i], 'base64').toString('ascii').split("\n");

      //  for each loop of the decodedContent to add each line to the CSV string
      for(let j = 1; j < decodedContent.length; j++){

        /* We check if the line is valid by checking if it matches the regex for a city name (Spanish or English) and a (positive or negative) temperature
          // [a-zñáéíóúüA-ZÑÁÉÍÓÚÜ]+ : it catches any word that starts with a letter and has any number of letters, including accents
          // (?:[\s-][a-zA-Z]+)* : after the first word, it catches any number of words that start with a space or a dash and have any number of letters (optional)
          // , : it catches a comma after the first word or (optional) following group of words
          // [-+]?[0-9]*\.?[0-9]+$/  : it catches a number that can be positive or negative, with or without decimals
        */
        if(/[a-zñáéíóúüA-ZÑÁÉÍÓÚÜ]+(?:[\s-][a-zA-Z]+)*,[-+]?[0-9]*\.?[0-9]+$/.test(decodedContent[j])) {
          csvContent = decodedContent[j] + "," + dates[i] + "\n";
        }
    }
  }
    
  if(csvContent) {
    // export CSV file and update contents of the last_date JSON file
    fs.writeFileSync("city_temperature_data.csv", csvContent, (err) => {
      console.log(err || "We have successfully updated the CSV file!");
    });

    last_date_json["last_date"] = dates[dates.length - 1];
    fs.writeFileSync("last_date.json", JSON.stringify(last_date_json), (err) => {
      console.log(err || "We have successfully updated the last_date JSON file!");
    });

  } else {
    console.log("No new commits to track")
  }

  } catch (error) {
    console.log(`Error! Status: ${error.status}. Message: ${error}`)
  }

}

// run file
generateCSVFilebyLatestCommitsTracked(true);

       