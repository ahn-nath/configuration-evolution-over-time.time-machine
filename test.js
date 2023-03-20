import test from 'ava';
import { Octokit } from "octokit"
import { decodeContentAndGenerateCSVLines, initializeVariables } from './app.js';
import fs from 'fs';


const input_folder = "input_folder/";
const output_folder = "output_folder/";

/**
 * Test that the GitHub API works with the authentication details.
 * When the authentication details are valid, the API should return a 200 status code. We use to test to check that the API works 
 * as expected before running app.js.
 */
test('GitHub API works with authentication details', async t => {

    const octokit = new Octokit({ auth: process.env.GITHUB_API_TOKEN });
    const result = await octokit.request("GET /repos/{owner}/{repo}/commits", {
        owner: "ahn-nath",
        repo: "configuration-evolution-over-time.source-file",
    });

    t.is(result.status, 200);
});


/**
 * Tests the decodeContentAndGenerateCSVLines function with valid input. 
 * When the function receives encoded content, it should decode it and generate the CSV lines with all the data.
 */
test('Test function can decode contents and generate CSV with valid lines', async t => {
    // input values
    var dates = ["2023-03-17T01:34:24Z",];
    var commitsContents = ["Y2l0eSx0ZW1wZXJhdHVyZQpHcmFuZCBGb3JrcywtNDEKQmVybGluLDQuMQpP\nb2RuYWRhdHRhLDQxCg==\n"];
    // out values
    const cvsContent = decodeContentAndGenerateCSVLines(commitsContents, dates);
    const expectedContent = "Grand Forks,-41,2023-03-17T01:34:24Z\nBerlin,4.1,2023-03-17T01:34:24Z\nOodnadatta,41,2023-03-17T01:34:24Z\n";

    t.is(cvsContent, expectedContent);
});

/**
 * Tests the decodeContentAndGenerateCSVLines function with invalid input.
 * When the function receives encoded content with invalid lines, it should decode it, ignore the wrong lines and generate the CSV lines with all the data.
 */
test('Test function can decode contents and generate CSV with invalid lines', async t => {
    // imput values
    var testString = "Caracas,48\nPanamá,-47\nThis is just the wrong output\n452"
    var dates = ["2023-03-17T01:34:24Z",];
    var commitsContents = [Buffer.from(testString).toString('base64')];
    // out values
    const cvsContent = decodeContentAndGenerateCSVLines(commitsContents, dates);
    const expectedContent = "Caracas,48,2023-03-17T01:34:24Z\nPanamá,-47,2023-03-17T01:34:24Z\n";

    t.is(cvsContent, expectedContent);
});

/**
 * Tests the initializeVariables function with correct input.
 * When the function receives the any null input, that is the date or the CSV file, it should initialize the variables with the default values to let
 * the generator create a CSV file from scratch.
 */
test('Test function correctly initializes with default values when the input is incorrect', async t => {
    // input values
    let last_date_json_test_filename = "last_date_test.json";
    let cvs_test_filename = "city_temperature_data_test.csv";
    // expected values
    const created_date = "2023-03-17T01:34:24Z"
    let last_date_json = JSON.parse(fs.readFileSync(`${input_folder}${last_date_json_test_filename}`, "utf8"));
    // out values
    const actualValues = initializeVariables(last_date_json_test_filename, cvs_test_filename);
    const expectedValues = ["city,temperature,timestamp\n", created_date, last_date_json];

    t.deepEqual(actualValues, expectedValues);

});


/**
 * Tests the initializeVariables function with correct input.
 * When the function receives the correct input, that is the date and the CSV file are present, it should initialize the variables with the given 
 * values to let the generator and REST calls work with new data or commits.
 */
test('Test function correctly initializes with given values when the input is correct', async t => {
    // input values
    let last_date_json_test_filename = "last_date_test.json";
    let cvs_test_filename = "city_temperature_data_test.csv";
    // expected values
    let last_date_test = new Date().toISOString();
    let cvsContents = fs.readFileSync(`${output_folder}${cvs_test_filename}`, 'utf8');
    fs.writeFileSync(`${input_folder}${last_date_json_test_filename}`, JSON.stringify({ last_date: last_date_test }));
    // out values
    const actualValues = initializeVariables(last_date_json_test_filename, cvs_test_filename);
    const expectedValues = [cvsContents, last_date_test, { last_date: last_date_test }];

    // change value back to null for other tests
    fs.writeFileSync(`${input_folder}${last_date_json_test_filename}`, JSON.stringify({ last_date: null }));

    t.deepEqual(actualValues, expectedValues);
});









