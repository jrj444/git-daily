-- AlterTable
ALTER TABLE `user` ADD COLUMN `gitlabAccessTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `gitlabRefreshToken` TEXT NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL;
