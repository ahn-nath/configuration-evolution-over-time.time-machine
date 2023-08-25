export function decodeContentAndGenerateCSVPatchHelper(commitFilesDictionary, date) {
    /*
        TODO: add docstring
    */
    let csvContent = [];

    // iterate over files in the commit
    for (let fileName in commitFilesDictionary) {
        // engine is the first word of the file name
        let engine = fileName.split(".")[0];
        let lines = commitFilesDictionary[fileName];

        // if "languages" is in lines, non-standard input
        let standard = "languages" in lines? false: true;

        if(standard){
            // while the lines being evaluated is valid and the index is not last
            // user regex to check line validity: it should be a word, followed by a colon
            let regexSource = /[a-zñáéíóúüA-ZÑÁÉÍÓÚÜ]+:/;
            let regexTarget = /[a-zñáéíóúüA-ZÑÁÉÍÓÚÜ]+:/;
            let index = 0;
            let sourceValid = regexSource.test(lines[index]);
            while(sourceValid && index < lines.length - 1){
                // initially, we assume the target is valid
                while(index < lines.length - 1){
                    let source = lines[index].split(":")[0];
                    let targetValid = regexTarget.test(lines[index]);

                    if(targetValid){
                        // add new line
                        let target = lines[index].split("-")[1];
                        let newLine  = source + "," + target + "," + date + "," + engine; // TODO: add the status
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