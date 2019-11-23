

exports.getNotVerifiedHashes = (database, fn) => {
    database.collection("not_verified").find({}, { projection: { hash: 1 }}).toArray((error, result) => {
        if(error)
        throw error;

        let array = [];
        result.forEach(element => {
            array.push(element.hash);
        });

        fn(array);
    });
}

exports.getToVerifyHashes = (database, fn) => {
    database.collection("to_verify").find({}, { projection: { hash: 1 }}).toArray((error, result) => {
        if(error)
        throw error;

        let array = [];
        result.forEach(element => {
            array.push(element.hash);
        });

        fn(array);
    });
}

exports.getProductsHashes = (database, fn) => {
    database.collection("products").find({}, { projection: { hash: 1 }}).toArray((error, result) => {
        if(error)
        throw error;

        let array = [];
        
        result.forEach(element => {
            array.push(element.hash);
        });

        fn(array);

    });
}