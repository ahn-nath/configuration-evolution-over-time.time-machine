# Configuration Evolution Over Time: Time Machine

## Project description

This project is a time machine for CSV files. It allows you to 
* track changes in CSV files over time,
* restore CSV files to a previous state,
* compare CSV files to a previous state,
* keep track of the last time a CSV file was changed and update it, accordingly without having to rewrite the data each time.

Essentially, it works as a parser, which reads the data into a native structure in memory and plays back the data repository's git history to parse the data at each commit, storing the entire sequence in memory along with the timestamp of the git commit. It uses the GitHub API to access the git history of the data repository.

As of now, it uses the GitHub repository [Configuration Evolution Over Time: Source File](https://github.com/ahn-nath/configuration-evolution-over-time.source-file) as the primarily data source, but it can be easily extended to use other data sources.

## Installation

### Requirements
* Node.js >= 14.0.0
* Git


### Setup

**Optional**

To avoid reaching the daily API rate limits while testing, you can create a personal access token:

- generate your personal access token from your GitHub account. Please go to [the GitHub docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-personal-access-token-classic). 

- manually rename the env.sample file to `.env` or use this command if available:
    ```
    mv env .env
    ```
- add your personal access token to the `.env` file
    ```
    GITHUB_TOKEN=your-personal-access-token
    ```

**NOTE:**

If you just need to test the API, you can ignore the steps above and remove the `{ auth: process.env.GITHUB_API_TOKEN }` option from the [app.js](./app.js) file. You should easily find this in the first few lines of the file.


**Required**
- clone this repository
  
    ```
    git clone ahn-nath/configuration-evolution-over-time.time-machine
    ```
- install dependencies
    ```
    npm install
    ```
- run tests
    ```
    npm test
    ```
- run the application to generate the results
    ```
    npm app.js
    ```

## Results

The results are stored in the `output_folder` folder. The results are generated in the following format:



| city        | temperature | timestampt           |
| ----------- | ----------- | -------------------- |
| Grand Forks | -41         | 2023-03-17T01:34:24Z |
| Berlin      | 4.1         | 2023-03-17T01:34:24Z |
| Oodnadatta  | 41          | 2023-03-17T01:34:24Z |
| Caracas     | 27          | 2023-03-17T01:34:24Z |


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.





 
