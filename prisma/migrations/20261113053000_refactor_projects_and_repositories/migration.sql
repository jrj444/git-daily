-- 1. Rename existing Project table to Repository
RENAME TABLE `Project` TO `Repository`;

-- 2. Alter Repository: drop old foreign key on User, add projectId column, rename existing indexes
ALTER TABLE `Repository` DROP FOREIGN KEY `Project_userId_fkey`;
ALTER TABLE `Repository` ADD COLUMN `projectId` VARCHAR(191) NULL AFTER `userId`;
ALTER TABLE `Repository` RENAME INDEX `Project_userId_gitlabProjectId_key` TO `Repository_userId_gitlabProjectId_key`;
ALTER TABLE `Repository` RENAME INDEX `Project_userId_idx` TO `Repository_userId_idx`;

-- 3. Create new Project table for Business Projects
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `Project_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Re-add foreign key from Repository to User
ALTER TABLE `Repository` ADD CONSTRAINT `Repository_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Add foreign key from Project to User
ALTER TABLE `Project` ADD CONSTRAINT `Project_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Add foreign key and index from Repository to Project
ALTER TABLE `Repository` ADD CONSTRAINT `Repository_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX `Repository_projectId_idx` ON `Repository`(`projectId`);

-- 7. Data migration: For each enabled repository, create an initial Business Project and link it
INSERT INTO `Project` (`id`, `userId`, `name`, `description`, `enabled`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT 
    CONCAT('proj_', `id`),
    `userId`,
    COALESCE(`alias`, SUBSTRING_INDEX(`nameWithNamespace`, '/', -1)),
    `nameWithNamespace`,
    `enabled`,
    0,
    `createdAt`,
    CURRENT_TIMESTAMP(3)
FROM `Repository`
WHERE `enabled` = 1;

UPDATE `Repository`
SET `projectId` = CONCAT('proj_', `id`)
WHERE `enabled` = 1;
