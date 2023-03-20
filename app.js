import { Octokit } from "octokit"
import fetch from 'node-fetch';
import fs from 'fs';

const octokit = new Octokit({ auth: process.env.GITHUB_API_TOKEN });
const created_date = "2023-03-17T01:34:24Z"
const input_folder = "input_folder/";
const output_folder = "output_folder/";


/*
  This function initializes the variables that will be used in the program
  @param last_date_filename: string that contains the name of the file that contains the date of the last commit tracked
  @param csv_filename: string that contains the name of the file that contains the CSV data
  @return csvContent: string that contains the CSV lines
  @return since: string that contains the date of the last commit tracked
  @return last_date_json: object that contains the date of the last commit tracked
*/
export function initializeVariables(last_date_filename = "last_date.json", csv_filename = "city_temperature_data.csv") {
  // initialize variables with default values 
  var csvContent = "city,temperature,timestamp\n";
  let since = created_date;

  // attempt to get the date and file 
  let last_date_json = JSON.parse(fs.readFileSync(`${input_folder}${last_date_filename}`, "utf8"));
  const fileExist = fs.existsSync(`${output_folder}${csv_filename}`);
  let date_is_valid = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/.test(last_date_json['last_date']);

  // if the file exists and the date is valid, we read the file and get the date of the latest commit tracked to write to existing file and get new data
  if (fileExist && date_is_valid) {
    csvContent = fs.readFileSync(`${output_folder}${csv_filename}`, "utf8");
    since = last_date_json['last_date'];
  }

  return [csvContent, since, last_date_json];
}


/*
  This function decodes the content of the commit and generates the CSV lines
  @param commitsContents: array of strings that contains the content of the commit
  @param dates: array of strings that contains the date of the commit
  @return csvContent: string that contains the CSV lines
*/
export function decodeContentAndGenerateCSVLines(commitsContents, dates) {

  let csvContent = "";

  for (let i = 0; i < commitsContents.length; i++) {
    // decode the commit content (base64) and split by line break
    let decodedContent = Buffer.from(commitsContents[i], 'base64').toString('utf8').split("\n");

    for (let j = 0; j < decodedContent.length; j++) {
      /* We check if the line is valid by checking if it matches the regex below:
          // [a-zñáéíóúüA-ZÑÁÉÍÓÚÜ]+ : it catches any word that starts with a letter and has any number of letters, including accents from the Spanish language
          // (?:[\s-][a-zA-Z]+)* : after the first word, it catches any number of words that start with a space or a dash and have any number of letters (optional)
          // , : it catches a comma after the first word or (optional) following group of words
          // [-+]?[0-9]*\.?[0-9]+$/  : it catches a number that can be positive or negative, with or without decimals
        */
      if (/[a-zñáéíóúüA-ZÑÁÉÍÓÚÜ]+(?:[\s-][a-zA-Z]+)*,[-+]?[0-9]*\.?[0-9]+$/.test(decodedContent[j])) {
        csvContent += decodedContent[j] + "," + dates[i] + "\n";
      }
    }
  }

  return csvContent;
}

/*
    This function generates a CSV file with the latest commits tracked
    @param debug: boolean that indicates if we want to debug the code 
    @return: void
*/
export async function generateCSVFilebyLatestCommitsTracked(csv_filename = "city_temperature_data.csv", last_date_filename = "last_date.json") {

  try {

    // initialize variables
    let [csvContent, since, last_date_json] = initializeVariables(last_date_filename, csv_filename);

    // get all commits from the repository by owner and repo name
    const result = await octokit.request("GET /repos/{owner}/{repo}/commits?path={path}&since={since}", {
      owner: "ahn-nath",
      repo: "configuration-evolution-over-time.source-file",
      path: "city_temperature_track",
      since: since
    });

    // if there are no new commits, we return
    if (result.data.length == 0 && result.status == 200) {
      console.log("No new commits to track")
      return
    }
    // raise exception if there is an error
    if (result.status != 200) {
      throw new Error(result);
    }
    // retrieve all content URLS and dates of commits
    const urls = result.data.map(item => item.url);
    var dates = result.data.map(item => item.commit.author.date);


    // each URL contains another address information about the content of the commit, which is in another link, we get it and access the content of the commit
    var commitsContents = await Promise.all(urls.map(async url => {
      //  fetch URL in JSON that contains content-related data about the commit and return it

      const response = await (await fetch(url)).text();
      const body = JSON.parse(response);

      const contentsURLText = await (await fetch(body.files[0].contents_url)).text();
      const content = JSON.parse(contentsURLText);

      return content.content;
    }
    ));

    // decode the content of the commit and generate the CSV lines
    csvContent += decodeContentAndGenerateCSVLines(commitsContents, dates);

    // export CSV file and update contents of the last_date JSON file
    fs.writeFileSync(`${output_folder}${csv_filename}` , csvContent, (err) => {
      console.log(err || "We have successfully updated the CSV file!");
    });

    // update the last_date JSON file
    let last_date = new Date(dates[dates.length - 1]);
    last_date.setSeconds(last_date.getSeconds() + 1);
    last_date_json["last_date"] = last_date.toISOString();
    fs.writeFileSync(`${input_folder}${last_date_filename}`, JSON.stringify(last_date_json), (err) => {
      console.log(err || "We have successfully updated the last_date JSON file!");
    });

  }
  catch (error) {
    console.log(`Error! Status: ${error.status}. Message: ${error}`)
  }
}



// run file
generateCSVFilebyLatestCommitsTracked(false);

