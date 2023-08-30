import { Octokit } from "octokit"
import fs from 'fs';
import { decodeContentAndGenerateCSVPatchHelper } from "./process_yaml_files.js";

// constants
const input_folder = "input_folder/";
const output_folder = "output_folder/";
// source #1: https://www.mediawiki.org/wiki/Content_translation/Machine_Translation/MT_Clients
let allowed_files = ["MinT.yaml", "Matxin.yaml", "Youdao.yaml", "Yandex.yaml", "Apertium.yaml",  "Apertium.wikimedia.yaml", "Elia.yaml", "Flores.yaml", "Google.yaml", "OpusMT.yaml", "LingCloud.yaml"]

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
export function decodeContentAndGenerateCSVLinesBase64(commitsContents, dates) {

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

export function decodeContentAndGenerateCSVLinesGitPatch(commitsContents, dates){
  
    let csvContent = "";
    let commitFilesDictionary = {};
  
    for (let i = 0; i < commitsContents.length; i++) {
      
      let commitFilesArr = commitsContents[i];

      // iterate over files in the commit
      for (let j = 0; j < commitFilesArr.length; j++) {
        // get the file name and the file content as an array of strings
        let file = commitFilesArr[j];
        let fileName = file.filename.split("/").at(-1)
        let fileContent = file.patch.split("\n");
        //split by line break and add to files dictionary
        commitFilesDictionary[fileName] = fileContent;

      }
      // process all files of this commit with function to generate CSV lines
      let decodedContent = decodeContentAndGenerateCSVPatchHelper(commitFilesDictionary, dates[i]);
      // array to string
      csvContent += decodedContent.join("\n");
    
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
      
      // save result to file
      fs.writeFileSync(`${output_folder}result.json`, JSON.stringify(result), (err) => {
        console.log(err || "We have successfully saved the result to a JSON file!");
      });

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
        
      // decode the content of the commit and generate the CSV lines ... here you select the processing type
      csvContent += decodeContentAndGenerateCSVLinesGitPatch(commitsContents, dates);

         /*NOTE: skip until we test getting all the commits. We could do it only after everything is processed
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


// testing the function
let commitsContents = [ 
  [
      
      {
        "sha": "0219d8c731fea36e4d2262d656d6208035ea9099",
        "filename": "config/Apertium.wikimedia.yaml",
        "status": "added",
        "additions": 123,
        "deletions": 0,
        "changes": 123,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FApertium.wikimedia.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FApertium.wikimedia.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FApertium.wikimedia.yaml?ref=3474645b2a4cdbdac93bd7740cb7c865963ab2f7",
        "patch": "@@ -0,0 +1,123 @@\n+af:\n+  - nl\n+an:\n+  - ca\n+  - es\n+ar:\n+  - mt\n+ast:\n+  - es\n+be:\n+  - ru\n+bg:\n+  - mk\n+br:\n+  - fr\n+ca:\n+  - an\n+  - eo\n+  - es\n+  - fr\n+  - oc\n+  - pt\n+  - simple\n+cy:\n+  - simple\n+da:\n+  - nb\n+  - nn\n+  - sv\n+en:\n+  - ca\n+  - eo\n+  - es\n+  - gl\n+  - sh\n+eo:\n+  - simple\n+es:\n+  - an\n+  - ast\n+  - ca\n+  - eo\n+  - fr\n+  - gl\n+  - it\n+  - oc\n+  - pt\n+  - simple\n+eu:\n+  - es\n+  - simple\n+fr:\n+  - ca\n+  - eo\n+  - es\n+gl:\n+  - es\n+  - pt\n+  - simple\n+hi:\n+  - ur\n+id:\n+  - ms\n+is:\n+  - simple\n+  - sv\n+it:\n+  - ca\n+  - es\n+  - sc\n+kk:\n+  - tt\n+mk:\n+  - bg\n+  - sr\n+ms:\n+  - id\n+mt:\n+  - ar\n+nb:\n+  - da\n+  - nn\n+  - sv\n+nl:\n+  - af\n+nn:\n+  - da\n+  - nb\n+  - sv\n+oc:\n+  - ca\n+  - es\n+pt:\n+  - ca\n+  - es\n+  - gl\n+ro:\n+  - es\n+ru:\n+  - be\n+se:\n+  - nb\n+sh:\n+  - simple\n+  - sl\n+simple:\n+  - ca\n+  - eo\n+  - es\n+  - gl\n+  - sh\n+sl:\n+  - sh\n+  - sr\n+sv:\n+  - da\n+  - is\n+  - nb\n+  - nn\n+tt:\n+  - kk\n+ur:\n+  - hi"
      },
      {
        "sha": "4de0b995e53bc06f4ccdbee508fa56ec33b86bb8",
        "filename": "config/Apertium.yaml",
        "status": "added",
        "additions": 131,
        "deletions": 0,
        "changes": 131,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FApertium.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FApertium.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FApertium.yaml?ref=3474645b2a4cdbdac93bd7740cb7c865963ab2f7",
        "patch": "@@ -0,0 +1,131 @@\n+af:\n+  - nl\n+an:\n+  - ca\n+  - es\n+ar:\n+  - mt\n+ast:\n+  - es\n+be:\n+  - ru\n+bg:\n+  - mk\n+br:\n+  - fr\n+ca:\n+  - an\n+  - en\n+  - eo\n+  - es\n+  - fr\n+  - oc\n+  - pt\n+  - simple\n+cy:\n+  - en\n+  - simple\n+da:\n+  - nb\n+  - nn\n+  - sv\n+en:\n+  - ca\n+  - eo\n+  - es\n+  - gl\n+  - sh\n+eo:\n+  - en\n+  - simple\n+es:\n+  - an\n+  - ast\n+  - ca\n+  - en\n+  - eo\n+  - fr\n+  - gl\n+  - it\n+  - oc\n+  - pt\n+  - simple\n+eu:\n+  - en\n+  - es\n+  - simple\n+fr:\n+  - ca\n+  - eo\n+  - es\n+gl:\n+  - en\n+  - es\n+  - pt\n+  - simple\n+hi:\n+  - ur\n+id:\n+  - ms\n+is:\n+  - en\n+  - simple\n+  - sv\n+it:\n+  - ca\n+  - es\n+  - sc\n+kk:\n+  - tt\n+mk:\n+  - bg\n+  - sr\n+ms:\n+  - id\n+mt:\n+  - ar\n+nb:\n+  - da\n+  - nn\n+  - sv\n+nl:\n+  - af\n+nn:\n+  - da\n+  - nb\n+  - sv\n+oc:\n+  - ca\n+  - es\n+pt:\n+  - ca\n+  - es\n+  - gl\n+ro:\n+  - es\n+ru:\n+  - be\n+se:\n+  - nb\n+sh:\n+  - en\n+  - simple\n+  - sl\n+simple:\n+  - ca\n+  - eo\n+  - es\n+  - gl\n+  - sh\n+sl:\n+  - sh\n+  - sr\n+sv:\n+  - da\n+  - is\n+  - nb\n+  - nn\n+tt:\n+  - kk\n+ur:\n+  - hi"
      },
      
      {
        "sha": "33535131c34fbda386832fbe5e1f2fa21f9f61c3",
        "filename": "config/Matxin.yaml",
        "status": "added",
        "additions": 2,
        "deletions": 0,
        "changes": 2,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FMatxin.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FMatxin.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FMatxin.yaml?ref=3474645b2a4cdbdac93bd7740cb7c865963ab2f7",
        "patch": "@@ -0,0 +1,2 @@\n+es:\n+  - eu"
      },
    
      {
        "sha": "cdebf36a7b8b897b240becc382a3ff9a3ebacc3e",
        "filename": "config/Yandex.yaml",
        "status": "added",
        "additions": 101,
        "deletions": 0,
        "changes": 101,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FYandex.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FYandex.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FYandex.yaml?ref=3474645b2a4cdbdac93bd7740cb7c865963ab2f7",
        "patch": "@@ -0,0 +1,101 @@\n+handler: Yandex.js\n+notAsTarget:\n+  - be-tarask\n+  - de\n+  - en\n+  - it\n+languages:\n+  - af\n+  - am\n+  - ar\n+  - az\n+  - ba\n+  - be\n+  - be-tarask\n+  - bn\n+  - bg\n+  - bs\n+  - ca\n+  - ceb\n+  - cs\n+  - cy\n+  - da\n+  - de\n+  - el\n+  - en\n+  - eo\n+  - es\n+  - et\n+  - eu\n+  - fa\n+  - fi\n+  - fr\n+  - ga\n+  - gd\n+  - gl\n+  - gu\n+  - he\n+  - hi\n+  - hr\n+  - ht\n+  - hu\n+  - hy\n+  - id\n+  - is\n+  - it\n+  - ja\n+  - jv\n+  - ka\n+  - kk\n+  - km\n+  - kn\n+  - ko\n+  - ky\n+  - la\n+  - lb\n+  - lo\n+  - lt\n+  - lv\n+  - mi\n+  - mg\n+  - mhr\n+  - ml\n+  - mk\n+  - mn\n+  - mrj\n+  - mr\n+  - ms\n+  - mt\n+  - my\n+  - nb\n+  - ne\n+  - nl\n+  - pa\n+  - pap\n+  - pl\n+  - pt\n+  - ro\n+  - ru\n+  - si\n+  - sk\n+  - sl\n+  - sq\n+  - sr\n+  - su\n+  - sv\n+  - sw\n+  - ta\n+  - te\n+  - tg\n+  - th\n+  - tl\n+  - tr\n+  - tt\n+  - udm\n+  - uk\n+  - ur\n+  - uz\n+  - vi\n+  - xh\n+  - yi\n+  - zh"
      },
      {
        "sha": "ab0de801f1acab5b53bc0d71605da8f4958227cc",
        "filename": "config/Youdao.yaml",
        "status": "added",
        "additions": 21,
        "deletions": 0,
        "changes": 21,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FYoudao.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/3474645b2a4cdbdac93bd7740cb7c865963ab2f7/config%2FYoudao.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FYoudao.yaml?ref=3474645b2a4cdbdac93bd7740cb7c865963ab2f7",
        "patch": "@@ -0,0 +1,21 @@\n+en:\n+  - zh\n+es:\n+  - zh\n+fr:\n+  - zh\n+ja:\n+  - zh\n+ko:\n+  - zh\n+pt:\n+  - zh\n+ru:\n+  - zh\n+zh:\n+  - es\n+  - fr\n+  - ja\n+  - ko\n+  - pt\n+  - ru"
      },
  
     
      
    ],
  
  
   [
      {
        "sha": "eb285a04d90ab60d7dc3a905273408ec64693a45",
        "filename": "config/Apertium.wikimedia.yaml",
        "status": "modified",
        "additions": 1,
        "deletions": 0,
        "changes": 1,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/3629581e6367246b627a29e5152ce6b662b11d4d/config%2FApertium.wikimedia.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/3629581e6367246b627a29e5152ce6b662b11d4d/config%2FApertium.wikimedia.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FApertium.wikimedia.yaml?ref=3629581e6367246b627a29e5152ce6b662b11d4d",
        "patch": "@@ -21,6 +21,7 @@ ca:\n   - oc\n   - pt\n   - simple\n+  - sc\n cy:\n   - simple\n da:"
      },
      {
        "sha": "91a99cb40b6f1f5eab5c9db8aa7948a76d5ec6e3",
        "filename": "config/Apertium.yaml",
        "status": "modified",
        "additions": 1,
        "deletions": 0,
        "changes": 1,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/3629581e6367246b627a29e5152ce6b662b11d4d/config%2FApertium.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/3629581e6367246b627a29e5152ce6b662b11d4d/config%2FApertium.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FApertium.yaml?ref=3629581e6367246b627a29e5152ce6b662b11d4d",
        "patch": "@@ -22,6 +22,7 @@ ca:\n   - oc\n   - pt\n   - simple\n+  - sc\n cy:\n   - en\n   - simple"
      }
    ],
  
  
   [
      {
        "sha": "e30cab26fb59b762977b383f616e00c6a7e382c1",
        "filename": "config/Apertium.wikimedia.yaml",
        "status": "modified",
        "additions": 2,
        "deletions": 0,
        "changes": 2,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/ccf606a2bdd9069a2d5dc40407eb4813ca37b501/config%2FApertium.wikimedia.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/ccf606a2bdd9069a2d5dc40407eb4813ca37b501/config%2FApertium.wikimedia.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FApertium.wikimedia.yaml?ref=ccf606a2bdd9069a2d5dc40407eb4813ca37b501",
        "patch": "@@ -22,6 +22,8 @@ ca:\n   - pt\n   - simple\n   - sc\n+crh:\n+  - tr\n cy:\n   - simple\n da:"
      },
      {
        "sha": "b6cbb178ebd5a907df6b5879f0c09d32411ddb43",
        "filename": "config/Apertium.yaml",
        "status": "modified",
        "additions": 2,
        "deletions": 0,
        "changes": 2,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/ccf606a2bdd9069a2d5dc40407eb4813ca37b501/config%2FApertium.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/ccf606a2bdd9069a2d5dc40407eb4813ca37b501/config%2FApertium.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FApertium.yaml?ref=ccf606a2bdd9069a2d5dc40407eb4813ca37b501",
        "patch": "@@ -23,6 +23,8 @@ ca:\n   - pt\n   - simple\n   - sc\n+crh:\n+  - tr\n cy:\n   - en\n   - simple"
      }
    ],
  
    [],
  
  [
      {
        "sha": "7ea56e4bc0a5b47a22d9a967f40006f390542870",
        "filename": "config/Apertium.wikimedia.yaml",
        "status": "modified",
        "additions": 1,
        "deletions": 1,
        "changes": 2,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/9d254853d6f19e3ba22833f49aed102815817e4c/config%2FApertium.wikimedia.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/9d254853d6f19e3ba22833f49aed102815817e4c/config%2FApertium.wikimedia.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FApertium.wikimedia.yaml?ref=9d254853d6f19e3ba22833f49aed102815817e4c",
        "patch": "@@ -22,7 +22,7 @@ ca:\n   - pt\n   - simple\n   - sc\n-crh:\n+crh-latn:\n   - tr\n cy:\n   - simple"
      },
      {
        "sha": "456ff385d93c39cfd51300406d49a317755baf54",
        "filename": "config/Apertium.yaml",
        "status": "modified",
        "additions": 1,
        "deletions": 1,
        "changes": 2,
        "blob_url": "https://github.com/wikimedia/mediawiki-services-cxserver/blob/9d254853d6f19e3ba22833f49aed102815817e4c/config%2FApertium.yaml",
        "raw_url": "https://github.com/wikimedia/mediawiki-services-cxserver/raw/9d254853d6f19e3ba22833f49aed102815817e4c/config%2FApertium.yaml",
        "contents_url": "https://api.github.com/repos/wikimedia/mediawiki-services-cxserver/contents/config%2FApertium.yaml?ref=9d254853d6f19e3ba22833f49aed102815817e4c",
        "patch": "@@ -23,7 +23,7 @@ ca:\n   - pt\n   - simple\n   - sc\n-crh:\n+crh-latn:\n   - tr\n cy:\n   - en"
      }
    ]
  
  ];
let dates =["2017-09-20T05:22:22Z", "2017-09-21T06:17:04Z", "2017-09-24T11:16:24Z", "2017-09-27T11:17:18Z", 
"2017-11-22T11:53:57Z"];
decodeContentAndGenerateCSVLinesGitPatch(commitsContents, dates);

/*
generateCSVFileByLatestCommitsTracked(2, allowed_files,
"MT_availability_timestamps.csv", "last_date_MT.json", "wikimedia", "mediawiki-services-cxserver", "/config", "2017-08-30T09:07:55Z")
*/

