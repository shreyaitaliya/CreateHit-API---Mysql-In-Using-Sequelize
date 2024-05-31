require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const dbConfig = {
    HOST: process.env.DB_HOST || "localhost",
    USER: process.env.DB_USER || "root",
    PASSWORD: process.env.DB_PASSWORD || "",
    dialect: "mysql",
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};

//create database
async function createDatabase(dbName) {
    const sequelize = new Sequelize('', dbConfig.USER, dbConfig.PASSWORD, {
        host: dbConfig.HOST,
        dialect: dbConfig.dialect,
        logging: false
    });

    try {
        await sequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`Database ${dbName} created successfully.`);
    } catch (error) {
        console.error('Error creating database:', error);
        throw error;
    }
    await sequelize.close();
}

//craete table and column
async function createTablesFromConfig(dbName) {
    //attach jsonFile
    const configPath = path.join(__dirname, 'databased-config.json');
    let config;

    try {
        const data = await fs.readFile(configPath, 'utf8');
        config = JSON.parse(data);
    } catch (error) {
        console.error('Error reading config file:', error);
        throw error;
    }

    const sequelize = new Sequelize(dbName, dbConfig.USER, dbConfig.PASSWORD, {
        host: dbConfig.HOST,
        dialect: dbConfig.dialect,
        logging: false
    });

    //loop for table and initialdata
    try {
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');

        for (const table of config.tables) {
            const { tableName, columns, initialData } = table;

            const tableColumns = {};
            for (const column of columns) {
                tableColumns[column.name] = {
                    type: Sequelize[column.type.toUpperCase()],
                    primaryKey: column.primaryKey || false,
                    autoIncrement: column.autoIncrement || false
                };
            }

            const Table = sequelize.define(tableName, tableColumns);

            await Table.sync({ force: true });
            console.log(`Table ${tableName} created successfully.`);

            if (initialData && Array.isArray(initialData)) {
                for (const data of initialData) {
                    await Table.create(data);
                }
                console.log(`Initial data inserted into table ${tableName} successfully.`);
            }
        }
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
    await sequelize.close();
}

app.post('/create-database', async (req, res) => {
    const { dbName } = req.body;

    if (!dbName) {
        return res.status(400).send({
            message: "Database name is required."
        });
    }

    try {
        await createDatabase(dbName);
        await createTablesFromConfig(dbName);
        res.status(201).send({
            message: `Database ${dbName} and tables created successfully.`,
            dbName
        });
    } catch (error) {
        res.status(500).send({
            message: "Failed to create database or tables.",
            error
        });
    }
});
9
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
});