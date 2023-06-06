import * as core from '@actions/core';
import * as github from '@actions/github';
import fetch from 'node-fetch';

async function generateCompletion(prompt: string, apiKey: string) {
  try {
    const response = await fetch("https://api.openai.com/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-davinci-003",
        prompt,
        temperature: 1,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API responded with status ${response.status}`);
    }

    const responseData = await response.json();
    return responseData.choices[0].text.trim();
  } catch (error: any) {
    core.setFailed(`Error during completion generation: ${error.message}`);
  }
}

async function run() {
  try {
    const githubToken = core.getInput('github_token');
    const openaiApiKey = core.getInput('openai_api_key');
    const octokit = github.getOctokit(githubToken);

    const { owner, repo, number } = github.context.issue;

    console.log('Owner:', owner);
    console.log('Repo:', repo);
    console.log('Number:', number);

    const filesResponse = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: number
    });

    const fileDescriptionsPromises = filesResponse.data.map(async (file: any) => {
      console.log('Filename:', file.filename);

      const fileContentResponse = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: 'refs/pull/' + number + '/head'
      });

      console.log('Ref:', 'refs/pull/' + number + '/head');

      const fileContent = Buffer.from((fileContentResponse.data as any).content, 'base64').toString('utf8');
      const prDescription = await generateCompletion(fileContent, openaiApiKey);

      return `- ${file.filename}: ${prDescription}`;
    });

    const fileDescriptions = await Promise.all(fileDescriptionsPromises);

    const prDescription = fileDescriptions.join('\n');

    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: number,
      body: prDescription
    });
  } catch (error: any) {
    core.setFailed(`Action failed with error ${error}`);
  }
}

run();
