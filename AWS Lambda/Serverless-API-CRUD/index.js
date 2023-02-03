const AWS = require('aws-sdk');
AWS.config.update( {
  region: 'ap-southeast-1'
});
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const dynamoDbTableName = 'productTable-1';
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';

exports.handler = async function(event) {
  console.log('Request event: ', event);
  let response;
  switch(true) {
    case event.httpMethod === 'GET' && event.path === healthPath:
      response = buildResponse(200);
      break;
    case event.httpMethod === 'GET' && event.path === productPath:
      response = await getProduct(event.queryStringParameters.productId);
      break;
    case event.httpMethod === 'GET' && event.path === productsPath:
      response = await getProducts();
      break;
    case event.httpMethod === 'POST' && event.path === productPath:
      response = await saveProduct(JSON.parse(event.body));
      break;
    case event.httpMethod === 'PATCH' && event.path === productPath:
      const requestBody = JSON.parse(event.body);
      response = await updateProduct(requestBody.productId, requestBody.updateKey, requestBody.updateValue);
      break;
    case event.httpMethod === 'DELETE' && event.path === productPath:
      response = await deleteProduct(JSON.parse(event.body).productId);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

async function getProduct(productId) {
  const params = {
    TableName: dynamoDbTableName,
    Key: {
      'productId': productId
    }
  }
  return await dynamoDb.get(params).promise().then((response) => {
    return buildResponse(200, response.Item);
  }, (error) => {
    console.error('DynamoDb (GET) Error: ', error);
  });
}

async function getProducts() {
  const params = {
    TableName: dynamoDbTableName
  }
  const allProducts = await scanDynamoDbRecords(params, []);
  const body = {
    products: allProducts
  }
  return buildResponse(200, body);
}

async function scanDynamoDbRecords(scanParams, itemArray) {
  try {
    const dynamoDbData = await dynamoDb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoDbData.Items);
    if (dynamoDbData.LastEvaluatedKey) {
      scanParams.ExclusiveStartkey = dynamoDbData.LastEvaluatedKey;
      return await scanDynamoDbRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch(error) {
    console.error('Scan DynamoDb Records Error: ', error);
  }
}

async function saveProduct(requestBody) {
  const params = {
    TableName: dynamoDbTableName,
    Item: requestBody
  }
  return await dynamoDb.put(params).promise().then(() => {
    const body = {
      Operation: 'SAVE',
      Message: 'SUCCESS',
      Item: requestBody
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Save to DynamoDb Error: ', error);
  })
}

async function updateProduct(productId, updateKey, updateValue) {
  const params = {
    TableName: dynamoDbTableName,
    Key: {
      'productId': productId
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ':value': updateValue
    },
    ReturnValues: 'UPDATED_NEW'
  }
  return await dynamoDb.update(params).promise().then((response) => {
    const body = {
      Operation: 'UPDATE',
      Message: 'SUCCESS',
      UpdatedAttributes: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Update to DynamoDb Error: ', error);
  })
}

async function deleteProduct(productId) {
  const params = {
    TableName: dynamoDbTableName,
    Key: {
      'productId': productId
    },
    ReturnValues: 'ALL_OLD'
  }
  return await dynamoDb.delete(params).promise().then((response) => {
    const body = {
      Operation: 'DELETE',
      Message: 'SUCCESS',
      Item: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Delete DynamoDb Error: ', error);
  })
}

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}
