const axios = require('axios');
const AWS = require('aws-sdk');
const ssm = new AWS.SSM();

const username = 'Benjamin-Fever';

exports.handler = async (event) => {
    try {
        // Retrieve the GitHub token from SSM Parameter Store
        const params = {
            Name: '/github/token',
            WithDecryption: true
        };
        const data = await ssm.getParameter(params).promise();
        const githubToken = data.Parameter.Value;

        // Make a request to GitHub API with the token
        const githubResponse = await axios.get(`https://api.github.com/users/${username}/repos`, {
            headers: {
                'Authorization': `token ${githubToken}`
            }
        });

        const repos = githubResponse.data;

        // Create an array of promises for fetching the portfolio-card.json files
        const repoDetailsPromises = repos.map(async (repo) => {
            try {
                const repoResponse = await axios.get(`https://api.github.com/repos/${username}/${repo.name}/contents/.github/portfolio-card.json`, {
                    headers: {
                        'Accept': 'application/vnd.github.v3.raw',
                        'Authorization': `token ${githubToken}`
                    }
                });

                const thumbnail = repoResponse.data;

                return {
                    name: repo.name,
                    description: thumbnail.description,
                    category: thumbnail.category,
                    created_at: new Date(repo.created_at).toLocaleDateString('en-US'),
                    image: thumbnail['image source']
                };
            } catch (err) {
                // If the portfolio-card.json file is not found or any other error occurs, return null
                return null;
            }
        });

        // Wait for all promises to resolve
        const repoDetails = await Promise.all(repoDetailsPromises);

        // Filter out null values (where portfolio-card.json was not found)
        const filteredRepoDetails = repoDetails.filter(detail => detail !== null);

        // Sort the repositories by created_at date
        filteredRepoDetails.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        return {
            statusCode: 200,
            body: JSON.stringify(filteredRepoDetails),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(error.message),
        };
    }
};
