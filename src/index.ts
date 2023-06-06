import * as core from '@actions/core';
import * as github from '@actions/github';
import fetch from 'node-fetch';

async function generateCompletion(prompt_val: string, apiKey: string, model_val: string, temperature_val: number, maxTokens: number, topP: number, frequencyPenalty: number, presencePenalty: number) {
  try {
    const response = await fetch("https://api.openai.com/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:model_val,
        prompt:prompt_val,
        temperature:temperature_val,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
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
    const model = core.getInput('model');
    const temperature = parseFloat(core.getInput('temperature'));
    const maxTokens = parseInt(core.getInput('max_tokens'));
    const topP = parseFloat(core.getInput('top_p'));
    const frequencyPenalty = parseFloat(core.getInput('frequency_penalty'));
    const presencePenalty = parseFloat(core.getInput('presence_penalty'));

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
      const prDescription = await generateCompletion(fileContent, openaiApiKey, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty);

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
