import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';

async function run(): Promise<void> {
  try {
    const openaiApiKey: string = core.getInput('openai_api_key', { required: true });
    const githubToken: string = core.getInput('github_token', { required: true });

    const octokit = github.getOctokit(githubToken);

    const { owner, repo, number } = github.context.issue;

    const filesResponse = await octokit.rest.pulls.listFiles({ owner, repo, pull_number: number });

    const fileDescriptionsPromises = filesResponse.data.map(async (file: any) => {
      const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
        prompt: `Describe the following code:\n\n${file.patch}`,
        max_tokens: 60,
        temperature: 0.2,
      }, {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        }
      });

      return `**${file.filename}**:\n\n${response.data.choices[0].text}`;
    });

    const fileDescriptions = await Promise.all(fileDescriptionsPromises);

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: fileDescriptions.join('\n\n')
    });

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An error occurred.');
    }
  }
}

run();
