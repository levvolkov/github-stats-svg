
# GitHub Stats Cards

Generate SVG cards with GitHub statistics (commits, stars, unique visitors, and more) that you can use in your profile or repository README.

<table border="0" align="center">
    <td>
	    <img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/streak_stats.svg#gh-dark-mode-only"/>
        <img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/streak_stats.svg#gh-light-mode-only"/>
	</td>
	<td>
		<img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/traffic_stats.svg#gh-dark-mode-only"/>
        <img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/traffic_stats.svg#gh-light-mode-only"/>
	</td>
</table>

<table border="0" align="center">
	<td>
		<img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/github_stats.svg#gh-dark-mode-only"/>
        <img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/github_stats.svg#gh-light-mode-only"/>
	</td>
	<td>
		<img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/language_stats.svg#gh-dark-mode-only"/>
        <img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/language_stats.svg#gh-light-mode-only"/>
	</td>
</table>

## Features

- Fetch user statistics using GitHub GraphQL and REST APIs
- Generate SVG files with results (stars, forks, contributions, lines changed, views, and more)
- Support for dark/light themes in SVG

## Installation and Usage

1. **Create a personal [GitHub access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens):**
   - Go to: **Settings** → **Developer settings** → <br> **Personal access tokens** → **Tokens (classic)** → <br> **Generate new token** → **Generate new token (classic)**
   - Set the expiration date for your GitHub personal token. After expiration, you will need to update the token for the workflow to work correctly.
   - Set the following permissions:
     - [x] **repo**
     - [x] **read:user**
   - Copy the token right after creation — you will not be able to view it again.

3. **Create a repository from the template:**
   - Click [Use this template](https://github.com/levvolkov/github-stats-svg/generate) and create a new repository based on the template.

4. **Add the token as a secret to your repository:**
   - Go to the **Settings** tab of your new repository.
   - In the left menu, select **Secrets and variables** → **Actions** or use [this link](../../settings/secrets/actions).
   - Click **New repository secret**.
   - In the **Name** field, enter: `ACCESS_TOKEN`.
   - In the **Value** field, paste the previously copied personal access token.
   - Save the secret.

5. **Run the workflow to generate statistics:**
   - Go to the **[Actions](../../actions/workflows/update-stats.yml)** tab of your repository.
   - Select the **Update GitHub stats SVG** workflow from the list on the left.
   - Click the **Run workflow** button (top right corner).

6. **Add the statistics to your GitHub profile README:**
   - Copy and paste the following code blocks into your markdown content.
   - Change the `username` value to your GitHub username.

 ```md
 <!-- Statistics: Commit series -->
 <img src="https://raw.githubusercontent.com/username/github-stats-svg/main/svg/streak_stats.svg#gh-dark-mode-only"/>
 <img src="https://raw.githubusercontent.com/username/github-stats-svg/main/svg/streak_stats.svg#gh-light-mode-only"/>
 ```
 ```md
 <!-- Statistics: Unique repository visitors -->
 <img src="https://raw.githubusercontent.com/username/github-stats-svg/main/svg/traffic_stats.svg#gh-dark-mode-only"/>
 <img src="https://raw.githubusercontent.com/username/github-stats-svg/main/svg/traffic_stats.svg#gh-light-mode-only"/>
 ```
 ```md
 <!-- Statistics: General statistics -->
 <img src="https://raw.githubusercontent.com/username/github-stats-svg/main/svg/github_stats.svg#gh-dark-mode-only"/>
 <img src="https://raw.githubusercontent.com/username/github-stats-svg/main/svg/github_stats.svg#gh-light-mode-only"/>
 ```
 ```md
 <!-- Statistics: Programming languages -->
 <img src="https://raw.githubusercontent.com/username/github-stats-svg/main/svg/language_stats.svg#gh-dark-mode-only"/>
 <img src="https://raw.githubusercontent.com/username/github-stats-svg/main/svg/language_stats.svg#gh-light-mode-only"/>
 ```

<br>

## Customizing SVG Styles

The appearance settings are stored directly in the generator files. You can easily change the [colors](https://colorscheme.ru/html-colors.html), add a border, set a card background, or change the time zone in the [`streakStats.js`](generate-cards/streakStats.js#L272) card to any of the [supported time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) by editing the relevant variables in these files:

1. **Where to configure**

<table>
	<tr align="center">
		<td> 
			<img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/streak_stats.svg#gh-dark-mode-only"/> 
			<img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/streak_stats.svg#gh-light-mode-only"/> 
		</td> 
		<td> 
			<img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/traffic_stats.svg#gh-dark-mode-only"/> 
			<img src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/traffic_stats.svg#gh-light-mode-only"/> 
		</td> 
		<td> 
			<img width="310px" height="92px" src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/github_stats.svg#gh-dark-mode-only"/> 
			<img width="310px" height="92px" src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/github_stats.svg#gh-light-mode-only"/> 
		</td> 
		<td> 
			<img width="160px" height="92px" src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/language_stats.svg#gh-dark-mode-only"/> 
			<img width="160px" height="92px" src="https://raw.githubusercontent.com/levvolkov/github-stats-svg/main/svg/language_stats.svg#gh-light-mode-only"/> 
		</td> 
	</tr> 
	<tr align="center"> 
		<td><code><a href="generate-cards/streakStats.js">streakStats.js</a></code></td> 
		<td><code><a href="generate-cards/trafficStats.js">trafficStats.js</a></code></td> 
		<td><code><a href="generate-cards/githubStats.js">githubStats.js</a></code></td> 
		<td><code><a href="generate-cards/languageStats.js">languageStats.js</a></code></td> 
	</tr> 
	<tr align="center"> 
		<td>Commit series</td> 
		<td>Unique repository visitors</td> 
		<td>General statistics</td> 
		<td>Programming languages</td> 
	</tr> 
	<tr align="center"> 
		<td>Lines <a href="generate-cards/streakStats.js#L16-L39">16-39</a></td> 
		<td>Lines <a href="generate-cards/trafficStats.js#L14-L42">14-42</a></td> 
		<td>Lines <a href="generate-cards/githubStats.js#L15-L31">15-31</a></td> 
		<td>Lines <a href="generate-cards/languageStats.js#L17-L37">17-37</a></td> 
	</tr> 
</table>

2. **How to change**
- Open the desired generator file in your copy of the repository
- Find the section with style settings
- Change the values as you wish
- Save the file and re-run the [workflow](../../actions/workflows/update-stats.yml) (if it doesn't start automatically)