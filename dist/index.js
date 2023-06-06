"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const axios_1 = __importDefault(require("axios"));
async function run() {
    try {
        const openaiApiKey = core.getInput('openai_api_key', { required: true });
        const githubToken = core.getInput('github_token', { required: true });
        const octokit = github.getOctokit(githubToken);
        const { owner, repo, number } = github.context.issue;
        const filesResponse = await octokit.rest.pulls.listFiles({ owner, repo, pull_number: number });
        const fileDescriptionsPromises = filesResponse.data.map(async (file) => {
            const response = await axios_1.default.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
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
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('An error occurred.');
        }
    }
}
run();
