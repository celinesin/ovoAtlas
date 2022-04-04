import os
import shutil
import tempfile
import unittest
from unittest.mock import patch
import pathlib

import tiledb

from backend.wmg.data.cube_pipeline import load, load_data_and_create_cube
from backend.wmg.data.load_corpus import load_h5ad
from backend.wmg.data.schemas.corpus_schema import create_tdb
from tests.unit.backend.wmg.fixtures.test_anndata_object import create_anndata_test_object


class TestCorpusLoad(unittest.TestCase):
    @staticmethod
    def fixture_file_path(relative_filename):
        import os

        parent_dir_of_curr_file = "/".join(os.path.dirname(__file__).split("/")[:-1])
        return os.path.abspath(os.path.join(parent_dir_of_curr_file, relative_filename))

    @classmethod
    def setUpClass(cls) -> None:
        super().setUp(cls)
        cls.tmp_dir = tempfile.mkdtemp()

        basic_test_anndata_object = create_anndata_test_object(num_genes=3, num_cells=5)
        larger_test_anndata_object = create_anndata_test_object(num_genes=1000, num_cells=5000)
        os.mkdir(f"{cls.tmp_dir}/datasets")
        os.mkdir(f"{cls.tmp_dir}/datasets/basic_test_dataset")
        os.mkdir(f"{cls.tmp_dir}/datasets/larger_test_dataset")

        cls.small_anndata_filename = pathlib.Path(cls.tmp_dir, "datasets/basic_test_dataset/local.h5ad")
        cls.large_anndata_filename = pathlib.Path(cls.tmp_dir, "datasets/larger_test_dataset/local.h5ad")

        cls.small_anndata_filename.touch()
        cls.large_anndata_filename.touch()

        basic_test_anndata_object.write(cls.small_anndata_filename, compression="gzip")
        larger_test_anndata_object.write(cls.large_anndata_filename, compression="gzip")

    @classmethod
    def tearDownClass(cls) -> None:
        super().tearDownClass()
        shutil.rmtree(cls.tmp_dir)

    def setUp(self) -> None:
        super().setUp()
        self.path_to_datasets = pathlib.Path(self.tmp_dir, "datasets")
        self.corpus_name = "test-group"
        self.corpus_path = f"{self.tmp_dir}/{self.corpus_name}"
        if not tiledb.VFS().is_dir(self.corpus_path):
            create_tdb(self.tmp_dir, self.corpus_name)
            # self.pbmc3k_anndata_object = get_test_anndata_dataset()

    def tearDown(self) -> None:
        super().tearDown()
        shutil.rmtree(self.corpus_path)

    @patch("backend.wmg.data.cube_pipeline.tiledb.consolidate")
    @patch("backend.wmg.data.cube_pipeline.tiledb.vacuum")
    @patch("backend.wmg.data.cube_pipeline.load_h5ad")
    def test__load_loads_all_datasets_in_directory(self, mock_load_h5ad, mock_vacuum, mock_consolidate):
        load(self.path_to_datasets, self.corpus_path)
        self.assertEqual(mock_load_h5ad.call_count, 2)
        self.assertEqual(mock_vacuum.call_count, 4)
        self.assertEqual(mock_consolidate.call_count, 4)

    @patch("backend.wmg.data.load_corpus.update_global_var")
    @patch("backend.wmg.data.load_corpus.validate_dataset_properties")
    def test_invalid_datasets_are_not_added_to_corpus(self, mock_validation, mock_global_var):
        mock_validation.return_value = False
        load(self.path_to_datasets, self.corpus_path)
        self.assertEqual(mock_global_var.call_count, 0)

    def test_global_var_array_updated_when_dataset_contains_new_genes(self):
        load_h5ad(self.small_anndata_filename, self.corpus_path, False)
        with tiledb.open(f"{self.corpus_path}/var", "r") as var:
            var_df = var.df[:]
            total_stored_genes = len(set(var_df["gene_ontology_term_id"].to_numpy(dtype=str)))
        small_gene_count = 3
        self.assertEqual(small_gene_count, total_stored_genes)

        load_h5ad(self.large_anndata_filename, self.corpus_path, False)

        large_gene_count = 1000  # overlapping genes should only be counted once
        with tiledb.open(f"{self.corpus_path}/var", "r") as var:
            var_df = var.df[:]
            total_stored_genes = len(set(var_df["gene_ontology_term_id"].to_numpy(dtype=str)))
        self.assertEqual(large_gene_count, total_stored_genes)

    def test_mapping_between_local_file_and_global_tdb_is_valid_and_consistent_as_datasets_are_added(self):
        """
        DO NOT DELETE THIS TEST
        """
        # load_h5ad(self.path_to_dataset_0, self.corpus_name, False)
        pass

    def test_axes_labels_updated_for_new_genes(self):
        pass

    def test_expression_matrix_matches_global_index(self):
        pass

    def test_raw_expression_matrix_normalized_by_rankit(self):
        pass

    @unittest.skip("removed corpus fixture")
    @patch("backend.wmg.data.cube_pipeline.extract.copy_datasets_to_instance")
    @patch("backend.wmg.data.cube_pipeline.extract.get_dataset_s3_uris")
    def test_corpus_creation_works_as_expected(self, mock_get_uris, mock_copy):
        load_data_and_create_cube(self.path_to_datasets, self.corpus_name, self.tmp_dir)

        # check obs
        with tiledb.open(f"{self.corpus_path}/obs", "r") as obs:
            actual_obs_df = obs.df[:]
        with tiledb.open(self.fixture_file_path("fixtures/small-corpus/obs"), "r") as obs:
            expected_obs_df = obs.df[:]

        self.assertTrue(
            expected_obs_df.development_stage_ontology_term_id.equals(actual_obs_df.development_stage_ontology_term_id)
        )
        self.assertTrue(expected_obs_df.obs_idx.equals(actual_obs_df.obs_idx))
        self.assertTrue(expected_obs_df.dataset_id.equals(actual_obs_df.dataset_id))
        self.assertTrue(expected_obs_df.dataset_local_cell_id.equals(actual_obs_df.dataset_local_cell_id))

        # check vars
        with tiledb.open(f"{self.corpus_path}/var", "r") as var:
            actual_var_df = var.df[:]
        with tiledb.open(self.fixture_file_path("fixtures/small-corpus/var"), "r") as var:
            expected_var_df = var.df[:]

        self.assertTrue(expected_var_df.equals(actual_var_df))

        # check expression matrix
        with tiledb.open(f"{self.corpus_path}/X", "r") as x:
            actual_x_df = x.df[:]
        with tiledb.open(self.fixture_file_path("fixtures/small-corpus/X"), "r") as x:
            expected_x_df = x.df[:]

        self.assertTrue(expected_x_df.equals(actual_x_df))