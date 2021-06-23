import { config } from "https://deno.land/x/dotenv/mod.ts";

// Config

const { ORG, TOKEN } = config();

// Types

type Repo = { name: string };

type Label = {
  id?: number;
  node_id?: string;
  url?: string;
  name: string;
  description: string;
  color: string;
  default?: boolean;
};

// API calls

const getRepos = (): Promise<Response> =>
  fetch(
    `https://api.github.com/orgs/${ORG}/repos?access_token=${TOKEN}`,
    {
      headers: {
        "Accept": "application/vnd.github.v3+json",
      },
    },
  );

const getLabels = (repo: string): Promise<Response> =>
  fetch(
    `https://api.github.com/repos/${ORG}/${repo}/labels?access_token=${TOKEN}`,
    {
      headers: {
        "Accept": "application/vnd.github.v3+json",
      },
    },
  );

const createLabel = (
  repo: string,
  label: Label,
): Promise<
  Response
> => (console.info(`Creating label ${label.name} on ${repo}...`),
  fetch(
    `https://api.github.com/repos/${ORG}/${repo}/labels?access_token=${TOKEN}`,
    {
      headers: {
        "Accept": "application/vnd.github.v3+json",
      },
      method: "POST",
      body: JSON.stringify({
        name: label.name,
        color: label.color,
        description: label.description,
      }),
    },
  ));

const deleteLabel = (
  label: Label,
): Promise<
  Response
> => (console.info(`Deleting label ${label.name} at ${label.url}...`),
  fetch(
    `${label.url}?access_token=${TOKEN}`,
    {
      headers: {
        "Accept": "application/vnd.github.v3+json",
      },
      method: "DELETE",
    },
  ));

// Helpers

const repoToJson = (response: Response): Promise<Repo[]> => response.json();
const labelToJson = (response: Response): Promise<Label[]> => response.json();
const repoName = (repo: Repo): string => repo.name;

const addDefaultLabels = (defaultLabels: Label[]) =>
  (repoName: string) =>
    defaultLabels.map((defaultLabel: Label): Promise<Response> =>
      createLabel(repoName, defaultLabel)
    );

const isCustomLabel = (defaultLabels: Label[]) =>
  (label: Label) =>
    defaultLabels.find((defaultLabel: Label): boolean =>
      defaultLabel.name === label.name && defaultLabel.color === label.color &&
      defaultLabel.description === label.description
    ) === undefined;

// Program

const decoder: TextDecoder = new TextDecoder("utf-8");
const data: BufferSource = Deno.readFileSync("default-labels.json");
const defaultLabels: Label[] = JSON.parse(decoder.decode(data));

const updateLabels = (
  repos: string[],
): Promise<
  Response[]
> => (console.info(`Found the following repos...\n${repos.join("\n")}`),
  Promise.all(repos.map(getLabels)).then((
    responses: Response[],
  ): Promise<Label[][]> => Promise.all(responses.map(labelToJson))).then((
    json: Label[][],
  ): Promise<Response[]> =>
    Promise.all(
      json.flat().filter(isCustomLabel(defaultLabels)).map(deleteLabel),
    )
  ).then((_responses: Response[]): Promise<Response[]> =>
    Promise.all(repos.map(addDefaultLabels(defaultLabels)).flat())
  ));

getRepos().then(repoToJson).then(
  (json: Repo[]): string[] => json.map(repoName),
).then(updateLabels).then((_) => console.info("Done!"));
