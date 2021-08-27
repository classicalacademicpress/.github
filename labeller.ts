import { config } from "https://deno.land/x/dotenv/mod.ts";
import { encode } from "https://deno.land/std/encoding/base64.ts";

// Config

const { ORG, USERNAME, TOKEN } = config();

// Types

type Repo = { name: string; archived: boolean };

type Label = {
  name: string;
  description: string;
  color: string;
};

// API requests

const signature: string = encode(USERNAME + ":" + TOKEN);

const request = (
  path: string,
  params?: { method?: string; body?: string },
): Promise<Response> =>
  fetch(`https://api.github.com${path}`, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "Authorization": `Basic ${signature}`,
    },
    ...params,
  });

const getReposByType = (type: string): Promise<Response> =>
  request(`/orgs/${ORG}/repos?per_page=50&type=${type}`);

const getRepos = async (): Promise<Repo[]> => {
  const types: string[] = ["public", "private"];
  const requests: Promise<Response>[] = types.map(getReposByType);
  const toJson = ((response: Response): Promise<Repo> => response.json());

  return await Promise.all(requests).then(
    (responses: Response[]) => Promise.all(responses.map(toJson)),
  ).then(
    (json: Repo[]) => json.flat().filter((repo: Repo) => !repo.archived),
  );
};

const getLabels = (repo: string): Promise<Label[]> =>
  request(`/repos/${ORG}/${repo}/labels?`).then((
    response: Response,
  ) => response.json());

const createLabel = (repo: string) =>
  (
    label: Label,
  ): Promise<
    Response
  > => (console.info(`Creating label ${label.name} on ${repo}...`),
    request(`/repos/${ORG}/${repo}/labels?`, {
      method: "POST",
      body: JSON.stringify({
        name: label.name,
        color: label.color,
        description: label.description,
      }),
    }));

const deleteLabel = (repo: string) =>
  (
    label: Label,
  ): Promise<
    Response
  > => (console.info(`Deleting label ${label.name} on ${repo}...`),
    request(
      `/repos/${ORG}/${repo}/labels/${label.name}`,
      {
        method: "DELETE",
      },
    ));

// Data helpers

const labelsEqual = (a: Label) =>
  (b: Label): boolean =>
    a.name === b.name &&
    a.color === b.color &&
    a.description === b.description;

const labelFound = (list: Label[]) =>
  (label: Label): boolean => list.find(labelsEqual(label)) !== undefined;

const isCustomLabel = (defaultLabels: Label[]) =>
  (label: Label) => !labelFound(defaultLabels)(label);

const missingDefaults = (defaultLabels: Label[], labels: Label[]): Label[] =>
  defaultLabels.filter((defaultLabel) => !labelFound(labels)(defaultLabel));

// Program

Deno.readFile("labels.json").then(async (data: BufferSource) => {
  const decoder: TextDecoder = new TextDecoder("utf-8");
  const defaultLabels: Label[] = JSON.parse(decoder.decode(data));
  const repoList = (repos: Repo[]): string =>
    repos.map((r) => r.name).sort().join("\n  ");

  return await getRepos().then((
    repos,
  ) => (console.info(`Checking the following repos...\n  ${repoList(repos)}`),
    repos.map((repo: Repo) =>
      getLabels(repo.name).then((labels) =>
        Promise.all(
          labels.filter((isCustomLabel(defaultLabels))).map(
            deleteLabel(repo.name),
          ),
        ).then((_) =>
          Promise.all(
            missingDefaults(defaultLabels, labels).map(createLabel(repo.name)),
          )
        )
      )
    ))
  );
}).then((_) => console.log("All done!"));
