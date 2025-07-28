# Group5

This is a training project, created on 24/07/2025.

功能需求
1. 用户管理
用户注册与登录（邮箱/手机号+密码）（JWT身份验证）
2. 投资组合管理

创建/删除投资组合

设置默认投资组合

投资组合重命名

3. 资产数据管理
支持多种资产类型：股票、基金、债券、加密货币、现金

资产基本信息存储（名称、代码、类型、图标）

资产价格历史数据存储

2是一个概述，像例子一样使用饼状图or something去概述一下用户的投资组合，3是把投资组合中的每一个小项单独拿出来详细介绍。

4. 持仓管理
 
添加/删除持仓

持仓数量调整

自动计算持仓价值（基于最新价格）

持仓收益计算（实现/未实现收益）

5. 交易记录
记录买入/卖出交易

交易详情：日期、资产、数量、价格、费用

交易历史查询与过滤

交易修改（限当日）

7. 市场数据集成
实时资产价格获取（通过金融API）

历史价格数据存储

自动定时更新资产价格

8. 时区显示：不同地方的开盘时间不一样，所以需要时区时间图。
用户可设置首选时区（默认根据浏览器时区自动检测）
支持所有IANA时区数据库中的时区。
每项资产关联其交易市场的时区

This is a training project, updated on July 28th.
# Future assets

I. Overview

Objective: The purpose of this document is to clearly and completely define the functional requirements of "Future Asset Management System" and provide a basis for design, development, testing and acceptance.
Overview: This system is an intelligent Web application for individual investors, aiming at "asset visualization, efficient management and scientific decision-making", focusing on the full-cycle management of individual investment assets. The core module includes user management, asset overview, position details and management. The system integrates real-time market and position data, and presents the net asset value, profit and loss and category/market allocation through visualization. Support personalized position screening and sorting, accurately calculate core indicators, and display information in layers from overview to detail. Relying on stable API and secure storage, it covers account management to asset monitoring scenarios to create a convenient and professional asset tracking experience.

II. Second, the functional requirements

Module 1:
1. User registration
Description: Allows users to create new accounts.
Detailed requirements: I hope to complete the registration by providing email address or mobile phone number and setting password.
Input: email address or mobile phone number, password and confirmation password.
Output: prompt of successful registration, guiding users to verify email/mobile phone number; Or an error prompt (e.g. mailbox already exists, wrong format).
2. User login and authentication
Description: Allows registered and authenticated users to log on to the system.
Detailed requirements: use email address/mobile phone number and password to log in to the system.
Input: email address or mobile phone number and password.
Output: log in successfully, and jump to the main page; Or login failure prompt.
3. Display user information
Description: After logging in, the user identity information will be displayed in the appropriate position of the interface.
Detailed requirements: As a logged-in user, I hope to see the user name (or email/mobile phone number) and avatar (if uploaded) after logging in, so as to confirm the current login identity.
Input: User login status.
Output: Display the user name and avatar (or default placeholder) in the interface (usually in the top navigation bar).

Module 2: Overview of Assets
1. Show the core overview indicators
Description: On the home page (main page) after login, provide users with a key summary of their portfolio.
Detailed requirements:
(1) See my Net Asset Value-NAV at the top of the homepage, that is, the current total market value of all positions.
(2) I hope to see the total investment cost (accumulated investment principal).
(3) I hope to see the amount and percentage of current floating profit and loss (total market value-total cost).
Input: user position data (quantity, cost price) and real-time market data (current price).
Output: clearly display the core indicator cards such as net asset value, total investment cost and floating profit and loss (amount+percentage).

2. Show real-time market summary
Description: display the key real-time market information of users' concerns or major market indexes on the home page.
Detailed requirements: See the real-time (or delayed) prices and price rises and falls of the targets of interest or major market indexes (such as CSI 300 and S&P 500) added by users on the homepage.
Input: user settings or default attention list/index list, third-party market API data.
Output: Display the name, current price, price fluctuation and price fluctuation of the target in the form of list or card.

3. Show asset allocation chart.
Description: Visualize the categories (such as stocks, funds, bonds, cash) or market distribution of users' assets through charts.
Detailed requirements: See a pie chart or ring chart on the home page to show the distribution ratio of users' assets in different categories (types) or different markets (regions).
Input: user position data (asset type/market classification) and real-time market data (used to calculate market value of various categories).
Output: A clear visual chart (such as pie chart) showing the asset allocation ratio with legend.

4. Show the summary of current positions.
Description: Show some of the most important or recently updated position information of users in a limited area on the homepage.
Detailed requirements:
(1) See a list on the home page, briefly showing some positions held by users (for example, the top 5-10 positions in descending order of market value, or user-defined filtering).
(2) Each position summary includes: asset name/code, current position quantity, current price, current market value and floating profit and loss.
(3) There is a "View All Positions" button or link at the bottom or next to the position summary list.
Input: all user position data and real-time market data.
Output: a concise table or list showing the key information of the screened positions; The View All Positions button/link points to the Portfolio Management page.

Module 3: Position Details
Description: Display all user's position records on an independent page.
Detailed requirements:
(1) When I click "View All Positions" on the homepage, I hope to jump to a new page and see all my positions.
(2) Each user's position record displays detailed information: asset name/code, asset type (stock/fund/bond, etc.), position quantity, average cost price, current price, current market value and floating profit and loss (amount+percentage).
(3) The position list supports sorting by asset name/code, type, market value, profit and loss, etc.
(4) When the number of positions is large (for example, > 20), the list can be automatically displayed in pages.
Input: all user position data (quantity, cost price) and real-time market data (current price).
Output: A table containing detailed information of all positions, which supports sorting and paging browsing.

Module 4: Position Management
Description: Allows users to view the details of a specific position.
Detailed requirements:
(1) When a user clicks a line (an asset) in the position list on the Portfolio Management page, he wants to jump to a new page or expand a panel to view more detailed information of the position.
(2) The detailed information users see includes (but is not limited to): asset name/code, type, current position quantity, average cost price, current price, current market value, floating profit and loss (amount+percentage), and the percentage of this asset in the total portfolio.
Input: user-selected specific asset tag type (such as ID or code).
Output: A concise view that focuses on the core details of the selected position.
