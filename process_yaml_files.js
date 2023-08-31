export function decodeContentAndGenerateCSVPatchHelper(commitFilesDictionary, date) {
    /*
        TODO: add docstring
    */
    let csvContent = [];

    // iterate over files in the commit
    for (let fileName in commitFilesDictionary) {
        // engine is the first word of the file name
        let engine = fileName.split(".yaml")[0];
        let lines = commitFilesDictionary[fileName];

        // if "languages" is in lines, non-standard input
        let standard = ["+languages:", "-languages:", "languages:"].some(r=> lines.includes(r)) ? false: true;

        if(standard){
            // while the lines being evaluated is valid and the index is not last
            // use regex to check line validity: it should be a word, followed by a colon
            let regexSource = /[a-zñáéíóúüA-ZÑÁÉÍÓÚÜ]+:/;
            // the target should be a word preceded by a space and a dash
            let regexTarget = /\s - [a-zA-Z]+/;
            let index = 1; // the first line is the patch info
            let sourceValid = regexSource.test(lines[index]);
            while(sourceValid && index < lines.length){
                // initially, we assume the target is valid
                let source = lines[index].split(":")[0].replace(/\+|-/, "");
                index++;
                while(index < lines.length){
                    let targetValid = regexTarget.test(lines[index]);

                    if(targetValid){
                        // add new line
                        let [operation_status, target] = lines[index].split(" - "); // TODO: find a better way to split the target when there are multiple "-"
                        let newLine = `${engine},${source},${target.trim()},${date},${operation_status.trim()}`;
                        csvContent.push(newLine);
                    }else{
                        // if the target is not valid, we break the loop and go to the next source
                        break;
                    }
                    index++;

                }
                // check if the next line is valid
                sourceValid = regexSource.test(lines[index]);
            }

        }else{
            // restrictions
            let english_variants = ['en', 'simple'];
            let not_as_target = [];

            // skip the first line
            let index = 1;
            // if the next line includes "notAsTarget", get the languages
            let linesIncludesNotAsTarget = ["+notAsTarget:", "notAsTarget:", "-notAsTarget"].some(r=> lines.includes(r));
            if(linesIncludesNotAsTarget){
                while(!lines[index].includes("languages:", 1)){
                    index++;
                    let not_as_target_lang = lines[index].split(" - ")[1].trim();
                    not_as_target.push(not_as_target_lang);
                }
            }

            // iterate over each language and get the source and target languages
            for (let lang in languages) {
                
                for (let target in languages) {

                    // if the target language is not the source, and it's not in the not_as_target list,
                    if ((lang != target) && !(target in not_as_target)) {
                        // and it's not an english variant
                        if (!(lang in english_variants) || !(target in english_variants)) {
                            // TODO: clean lang and target
                            let newLine  = lang + "," + target + "," + date + "," + engine; // TODO: add the status
                            csvContent.push(newLine);
                        }
                    }
                }
            }
        }
    }

    // out
    return cvs_pairs_dict;
}