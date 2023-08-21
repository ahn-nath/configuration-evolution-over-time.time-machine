import { Octokit } from "octokit"
import fs from 'fs';

// constants
const input_folder = "input_folder/";
const output_folder = "output_folder/";
// source #1: https://www.mediawiki.org/wiki/Content_translation/Machine_Translation/MT_Clients
let allowed_files = ["MinT.yaml", "Matxin.yaml", "Youdao.yaml", "Yandex.yaml", "Apertium.yaml", "Elia.yaml", "Flores.yaml", "Google.yaml", "OpusMT.yaml", "LingCloud.yaml"]

// Octokit
const octokit = new Octokit({auth: process.env.GITHUB_API_TOKEN});


/*
  This function initializes the variables that will be used in the program
  @param last_date_filename: string that contains the name of the file that contains the date of the last commit tracked
  @param csv_filename: string that contains the name of the file that contains the CSV data
  @return csvContent: string that contains the CSV lines
  @return since: string that contains the date of the last commit tracked
  @return last_date_json: object that contains the date of the last commit tracked
*/
export function initializeVariables(last_date_filename = "last_date.json", csv_filename = "city_temperature_data.csv", created_date = "2023-03-17T01:34:24Z") {
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

// ## NOTE: important reference for decoding: https://stackoverflow.com/questions/987372/what-is-the-format-of-a-patch-file
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


export async function generateCSVFileByLatestCommitsTracked(content_proccessing_type, allowed_files, csv_filename = "city_temperature_data.csv", last_date_filename = "last_date.json", repo_owner = "ahn-nath", repo_name = "configuration-evolution-over-time.source-file", repo_path = "city_temperature_track", created_date) {

    // initialize variables
    let [csvContent, since, last_date_json] = initializeVariables(last_date_filename, csv_filename, created_date);
    
    try {
      // get all commits from the repository by owner and repo name
      const result = await octokit.paginate('GET /repos/{owner}/{repo}/commits?path={path}&since=2017-08-30T09:07:55Z', {
        owner: repo_owner,
        repo: repo_name,
        path: repo_path,
        since: since,
      });
      
      // if there are no new commits, we return
      if (result.length == 0) {
        console.log("No new commits to track")
        return
      }
 
      // retrieve all content URLS and dates of commits
      let string_url_format = `GET /repos/${repo_owner}/${repo_name}/commits/`;
      const urls = result.map(item => string_url_format + item.sha);
      var dates = result.map(item => item.commit.author.date);

      // get the content of the commits by going to specific URLs
      var commitsContents = await Promise.all(urls.map(async url => {

        // fetch URL in JSON that contains content-related data. We use Octokit because the call is authenticated by default
        let response = await octokit.request(url);
        // we return the files in the allowed list, which allows for flexibility on whether to get the raw content or the git patch of the file 
        // this also mean that the final array may be empty if none of the files are not in the allowed list
        let files = response.data.files.filter(file => allowed_files.includes(file.filename.split("/").at(-1)));

        // out
        return files;
      }
      ));

      let commitsContentsLength = commitsContents.length;
      console.log("commitsContentsLength", commitsContentsLength)
      console.log("commitsContents", commitsContents.length)

      /*
        commitsContents+=
        dates+=

        /*NOTE: skip until we test getting all the commits. We could do it only after everything is processed
        // decode the content of the commit and generate the CSV lines ... here you select the processing type
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
      */
    
  }
    
    catch (error) {
      console.log(`Error! Status: ${error.status}. Message: ${error}`)
    }

 
}



generateCSVFileByLatestCommitsTracked(2, allowed_files,
  "MT_availability_timestamps.csv", "last_date_MT.json", "wikimedia", "mediawiki-services-cxserver", "/config", "2017-08-30T09:07:55Z")