<?php require 'vendor/autoload.php'; use Spatie\SimpleExcel\SimpleExcelWriter; \ = SimpleExcelWriter::streamDownload('test.xlsx'); \->addRow(['a' => 1]); \->toBrowser();
